import { expect, it } from "vitest";
import { applicationFields, periodFields } from "../../test/admissions-fixtures";
import { allOperations, finishOperation, operationByKey } from "../../test/admissions-workflow";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

async function overviewFixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "applicant@uio.no");
	const now = Date.now();
	const periodId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, { revision: 0, interviewEndAt: now + 7 * 86400000 }),
		),
	);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicant._id, { revision: 0 }),
		),
	);
	return { t, admin, periodId, applicationId };
}

it("shows unresolved mail delivery failures in the admin overview", async () => {
	const { t, admin, periodId, applicationId } = await overviewFixture();
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

it("queues one retryable Slack alert when a provider reports a failed email", async () => {
	const { t, periodId, applicationId } = await overviewFixture();
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
	await t.mutation(internal.admissions.delivery.recordProviderEvent, {
		emailId: "resend-email-1",
		type: "email.bounced",
	});
	await t.mutation(internal.admissions.delivery.recordProviderEvent, {
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

it("exposes captured email content only in local admin previews", async () => {
	const { t, admin, periodId, applicationId } = await overviewFixture();
	await t.run((ctx) =>
		ctx.db.insert("admissionDeliveries", {
			periodId,
			applicationId,
			kind: "offer",
			idempotencyKey: "local-capture",
			emailId: "local:offer",
			status: "delivered",
			localPreview: {
				to: "applicant@example.test",
				subject: "Tilbud om plass",
				html: "<p>Hei</p>",
			},
		}),
	);
	process.env.CONVEX_CLOUD_URL = "http://127.0.0.1:3210";
	process.env.APP_ENV = "local";
	try {
		const preview = await asUser(t, admin).query(api.admissions.queries.adminOverview, {
			periodId,
		});
		expect(preview?.localEmails).toEqual([
			{ to: "applicant@example.test", subject: "Tilbud om plass", html: "<p>Hei</p>" },
		]);
		process.env.CONVEX_CLOUD_URL = "https://production.convex.cloud";
		const production = await asUser(t, admin).query(api.admissions.queries.adminOverview, {
			periodId,
		});
		expect(production?.localEmails).toEqual([]);
	} finally {
		delete process.env.CONVEX_CLOUD_URL;
		delete process.env.APP_ENV;
	}
});

it("routes admission mail webhooks through the shared callback without touching feedback", async () => {
	const { t, periodId, applicationId } = await overviewFixture();
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
		const { t, periodId, applicationId } = await overviewFixture();
		const input = {
			periodId,
			applicationId,
			kind: "offer" as const,
			idempotencyKey: "offer:retry",
			emailId: "resend-stable-id",
		};
		const deliveryId = await t.mutation(internal.admissions.delivery.recordQueued, input);
		await t.mutation(internal.admissions.delivery.recordProviderEvent, {
			emailId: input.emailId,
			type: `email.${status}`,
		});
		const before = await t.run((ctx) => ctx.db.get(deliveryId));
		expect(before?.status).toBe(status);
		expect(await t.mutation(internal.admissions.delivery.recordQueued, input)).toBe(deliveryId);
		expect(await t.run((ctx) => ctx.db.get(deliveryId))).toEqual(before);
	},
);
