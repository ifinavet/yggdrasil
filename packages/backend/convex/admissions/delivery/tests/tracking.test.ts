import { expect, it } from "vitest";
import { admissionApplicationFixture, periodFields } from "../../../../test/admissions-fixtures";
import {
	allOperations,
	finishOperation,
	operationByKey,
} from "../../../../test/admissions-workflow";
import { asUser } from "../../../../test/fixtures";
import { api, internal } from "../../../_generated/api";

it("shows unresolved mail delivery failures in the admin overview", async () => {
	const { t, admin, periodId, applicationId } = await admissionApplicationFixture(
		{ revision: 0 },
		{ revision: 0 },
	);
	const statuses = ["queued", "delivered", "delayed", "failed", "bounced", "complained"] as const;
	await t.run(async (ctx) => {
		for (const status of statuses) {
			await ctx.db.insert("admissionDeliveries", {
				periodId,
				applicationId,
				kind: "offer",
				idempotencyKey: `delivery:${status}`,
				emailId: `email:${status}`,
				status,
				...(status !== "queued" && status !== "delivered" ? { error: `status:${status}` } : {}),
			});
		}
	});
	const overview = await asUser(t, admin).query(api.admissions.queries.adminOverview, { periodId });
	expect(overview?.deliveryIssues.map(({ status }) => status)).toEqual([
		"delayed",
		"failed",
		"bounced",
		"complained",
	]);
	expect(overview?.deliveryIssues.map(({ error }) => error)).toEqual([
		"status:delayed",
		"status:failed",
		"status:bounced",
		"status:complained",
	]);
});

it("keeps current-period delivery failures visible after successful history", async () => {
	const { t, admin, periodId, applicationId } = await admissionApplicationFixture(
		{ revision: 0 },
		{ revision: 0 },
	);
	const otherPeriodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, { revision: 0 })),
	);
	await t.run(async (ctx) => {
		for (let index = 0; index < 201; index++) {
			await ctx.db.insert("admissionDeliveries", {
				periodId,
				applicationId,
				kind: "offer",
				idempotencyKey: `delivered:${index}`,
				emailId: `delivered:${index}`,
				status: "delivered",
			});
		}
		for (const [status, scope] of [
			["failed", periodId],
			["bounced", periodId],
			["failed", otherPeriodId],
		] as const) {
			await ctx.db.insert("admissionDeliveries", {
				periodId: scope,
				applicationId,
				kind: "offer",
				idempotencyKey: `failure:${scope}:${status}`,
				emailId: `failure:${scope}:${status}`,
				status,
				error: `error:${scope}:${status}`,
			});
		}
	});

	const overview = await asUser(t, admin).query(api.admissions.queries.adminOverview, { periodId });
	expect(overview?.deliveryIssues).toHaveLength(2);
	expect(overview?.deliveryIssues.map(({ status, error }) => ({ status, error }))).toEqual([
		{ status: "failed", error: `error:${periodId}:failed` },
		{ status: "bounced", error: `error:${periodId}:bounced` },
	]);
});

it("queues one retryable Slack alert when a provider reports a failed email", async () => {
	const { t, periodId, applicationId } = await admissionApplicationFixture(
		{ revision: 0 },
		{ revision: 0 },
	);
	await t.run((ctx) =>
		ctx.db.insert("admissionDeliveries", {
			periodId,
			applicationId,
			kind: "offer",
			idempotencyKey: "offer:revision-1",
			emailId: "resend-email-1",
			status: "queued",
		}),
	);
	await t.mutation(internal.admissions.delivery.tracking.recordProviderEvent, {
		emailId: "resend-email-1",
		type: "email.bounced",
	});
	await t.mutation(internal.admissions.delivery.tracking.recordProviderEvent, {
		emailId: "resend-email-1",
		type: "email.bounced",
	});
	const jobs = await t.run((ctx) => allOperations(ctx));
	expect(jobs).toHaveLength(1);
	expect(jobs[0]).toMatchObject({
		kind: "delivery_failure",
		periodId,
		applicationId,
		deliveryId: expect.any(String),
		idempotencyKey: expect.stringContaining("delivery-failure:"),
		state: "inProgress",
	});
	const idempotencyKey = jobs[0]?.idempotencyKey;
	if (!idempotencyKey) throw new Error("Missing delivery failure idempotency key");
	await finishOperation(t, idempotencyKey, "Slack API unavailable");
	const retried = await t.run((ctx) => operationByKey(ctx, idempotencyKey));
	expect(retried).toMatchObject({ state: "failed", lastError: "Slack API unavailable" });
});

it("keeps queued mail pending until the provider confirms delivery", async () => {
	const { t, periodId, applicationId } = await admissionApplicationFixture();
	const emailId = "provider-confirmation";
	const deliveryId = await t.mutation(internal.admissions.delivery.tracking.recordQueued, {
		periodId,
		applicationId,
		kind: "offer",
		idempotencyKey: emailId,
		emailId,
	});
	expect((await t.run((ctx) => ctx.db.get(deliveryId)))?.status).toBe("queued");
	await t.mutation(internal.admissions.delivery.tracking.recordProviderEvent, {
		emailId,
		type: "email.delivered",
	});
	expect((await t.run((ctx) => ctx.db.get(deliveryId)))?.status).toBe("delivered");
});

it("routes admission mail webhooks through the shared callback without touching feedback", async () => {
	const { t, periodId, applicationId } = await admissionApplicationFixture(
		{ revision: 0 },
		{ revision: 0 },
	);
	const deliveryId = await t.run((ctx) =>
		ctx.db.insert("admissionDeliveries", {
			periodId,
			applicationId,
			kind: "offer",
			idempotencyKey: "admission-webhook",
			emailId: "admission-email",
			status: "queued",
		}),
	);
	await t.mutation(internal.feedback.delivery.messages.onEmailEvent, {
		id: "admission-email" as import("@convex-dev/resend").EmailId,
		event: {
			type: "email.delivered",
			created_at: new Date().toISOString(),
			data: {
				email_id: "admission-email",
				created_at: new Date().toISOString(),
				from: "info@ifinavet.no",
				to: ["applicant@uio.no"],
				subject: "Tilbud om opptak",
			},
		},
	});
	expect((await t.run((ctx) => ctx.db.get(deliveryId)))?.status).toBe("delivered");
	expect(await t.run((ctx) => ctx.db.query("feedbackInvites").collect())).toEqual([]);
});

it.each(["delivered", "bounced", "complained", "failed"] as const)(
	"preserves provider status %s when recording the same queued email again",
	async (status) => {
		const { t, periodId, applicationId } = await admissionApplicationFixture(
			{ revision: 0 },
			{ revision: 0 },
		);
		const input = {
			periodId,
			applicationId,
			kind: "offer" as const,
			idempotencyKey: "offer:retry",
			emailId: "resend-stable-id",
		};
		const deliveryId = await t.mutation(internal.admissions.delivery.tracking.recordQueued, input);
		await t.mutation(internal.admissions.delivery.tracking.recordProviderEvent, {
			emailId: input.emailId,
			type: `email.${status}`,
		});
		const before = await t.run((ctx) => ctx.db.get(deliveryId));
		expect(before?.status).toBe(status);
		expect(await t.mutation(internal.admissions.delivery.tracking.recordQueued, input)).toBe(
			deliveryId,
		);
		expect(await t.run((ctx) => ctx.db.get(deliveryId))).toEqual(before);
	},
);

it.each([
	[["email.delivered", "email.delivery_delayed", "email.sent"], "delivered"],
	[["email.bounced", "email.delivered"], "bounced"],
	[["email.complained", "email.delivered"], "complained"],
	[["email.suppressed", "email.sent"], "failed"],
	[["email.delivery_delayed", "email.delivered", "email.opened"], "delivered"],
] as const)("keeps provider sequence %j at %s", async (events, expected) => {
	const { t, periodId, applicationId } = await admissionApplicationFixture();
	const emailId = "provider-transition";
	const deliveryId = await t.mutation(internal.admissions.delivery.tracking.recordQueued, {
		periodId,
		applicationId,
		kind: "offer",
		idempotencyKey: emailId,
		emailId,
	});
	for (const type of events)
		await t.mutation(internal.admissions.delivery.tracking.recordProviderEvent, { emailId, type });
	expect((await t.run((ctx) => ctx.db.get(deliveryId)))?.status).toBe(expected);
});
