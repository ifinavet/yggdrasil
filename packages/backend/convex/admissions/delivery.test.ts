import { expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

async function overviewFixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "applicant@uio.no");
	const now = Date.now();
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", {
			title: "Høst 2026",
			applicationStartAt: now - 1000,
			applicationEndAt: now + 86400000,
			interviewStartAt: now + 172800000,
			interviewEndAt: now + 604800000,
			retentionAt: now + 1209600000,
			status: "open",
			revision: 0,
			interviewers: [],
			duration: 15,
			buffer: 5,
			breakEvery: 3,
			breakMinutes: 15,
			lunch: true,
			room: "Beta",
			dayStart: 540,
			dayEnd: 960,
			breaks: [],
			timezone: "Europe/Oslo",
			round: 1,
			roundHistory: [],
			createdBy: admin._id,
			updatedBy: admin._id,
		}),
	);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 0,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
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
	const jobs = await t.run((ctx) => ctx.db.query("admissionOutbox").collect());
	expect(jobs).toHaveLength(1);
	expect(jobs[0]).toMatchObject({
		kind: "delivery_failure",
		periodId,
		applicationId,
		deliveryId: expect.any(String),
		idempotencyKey: expect.stringContaining("delivery-failure:"),
		state: "pending",
	});
	const idempotencyKey = jobs[0]?.idempotencyKey;
	if (!idempotencyKey) throw new Error("Missing delivery failure idempotency key");
	await t.mutation(internal.admissions.internal.failOutbox, {
		idempotencyKey,
		error: "Slack API unavailable",
		nextAttemptAt: Date.now() + 60_000,
	});
	const retried = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique(),
	);
	expect(retried).toMatchObject({ state: "failed", lastError: "Slack API unavailable" });
	expect(retried?.nextAttemptAt).toBeGreaterThan(Date.now());
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
