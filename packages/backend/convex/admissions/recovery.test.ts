import { expect, it } from "vitest";
import { applicationFields, periodFields } from "../../test/admissions-fixtures";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

async function recoveryFixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const periodId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, {
				applicationStartAt: Date.now() - 86400000,
				applicationEndAt: Date.now() + 86400000,
				interviewStartAt: Date.now() + 172800000,
				interviewEndAt: Date.now() + 604800000,
				retentionAt: Date.now() + 1209600000,
				revision: 0,
			}),
		),
	);
	return { t, admin: asUser(t, admin), periodId };
}

function outboxJob(
	periodId: Awaited<ReturnType<typeof recoveryFixture>>["periodId"],
	idempotencyKey: string,
	state: "pending" | "running" | "failed" | "done",
	nextAttemptAt: number,
) {
	return {
		kind: "archive_channel" as const,
		periodId,
		revision: 0,
		idempotencyKey,
		state,
		attempts: 1,
		nextAttemptAt,
		createdAt: Date.now(),
	};
}

it("lets admins retry terminal failures without starting concurrent workers", async () => {
	const { t, admin, periodId } = await recoveryFixture();
	const now = Date.now();
	await t.run(async (ctx) => {
		await ctx.db.insert("admissionOutbox", outboxJob(periodId, "failed-job", "failed", now));
		await ctx.db.insert(
			"admissionOutbox",
			outboxJob(periodId, "expired-running", "running", now - 1),
		);
		await ctx.db.insert(
			"admissionOutbox",
			outboxJob(periodId, "active-running", "running", now + 60000),
		);
		await ctx.db.insert("admissionOutbox", outboxJob(periodId, "done-job", "done", now));
	});
	await expect(
		admin.mutation(api.admissions.recovery.retryOutbox, { idempotencyKey: "failed-job" }),
	).resolves.toMatchObject({ queued: true });
	await expect(
		admin.mutation(api.admissions.recovery.retryOutbox, { idempotencyKey: "expired-running" }),
	).resolves.toMatchObject({ queued: false, reason: "running" });
	await expect(
		admin.mutation(api.admissions.recovery.retryOutbox, { idempotencyKey: "active-running" }),
	).resolves.toMatchObject({ queued: false, reason: "running" });
	await expect(
		admin.mutation(api.admissions.recovery.retryOutbox, { idempotencyKey: "done-job" }),
	).resolves.toMatchObject({ queued: false, reason: "done" });
	const jobs = await t.run((ctx) => ctx.db.query("admissionOutbox").collect());
	expect(jobs.filter((job) => job.state === "pending")).toHaveLength(1);
	expect(jobs.find((job) => job.idempotencyKey === "failed-job")?.attempts).toBe(0);
});

it("alerts #system and purges closing data after cleanup exhausts its retries", async () => {
	const { t, periodId } = await recoveryFixture();
	await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "closing" });
		await ctx.db.insert("admissionOutbox", {
			...outboxJob(periodId, "archive-exhausted", "running", Date.now()),
			attempts: 8,
		});
	});
	await t.mutation(internal.admissions.internal.failOutbox, {
		idempotencyKey: "archive-exhausted",
		error: "Slack unavailable",
		nextAttemptAt: Date.now() + 60_000,
	});
	const period = await t.run((ctx) => ctx.db.get(periodId));
	const alerts = await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect());
	expect(period).toBeNull();
	expect(alerts).toHaveLength(1);
	expect(alerts[0]?.text).toContain("Admissions integration retry limit reached");
	expect(alerts[0]?.text).toContain("Høst 2026");
	expect(alerts[0]?.text).toContain(`Slack channel h26-opptak or h26-opptak-${periodId}`);
	expect(alerts[0]?.text).toContain(`owner admissions:${periodId}`);
	expect(alerts[0]?.text).not.toContain("Slack unavailable");
});

it("alerts before closing when the declined-offer notice exhausts retries", async () => {
	const { t, periodId } = await recoveryFixture();
	const applicant = await insertUser(t, "applicant@uio.no");
	const applicationId = await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "closing" });
		const applicationId = await ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicant._id, {
				revision: 2,
				decisionRevision: 3,
				decision: "accepted",
				decisionSentAt: Date.now() - 1_000,
				offerStatus: "declined",
				sent: true,
			}),
		);
		await ctx.db.insert("admissionOutbox", {
			kind: "offer_declined",
			periodId,
			applicationId,
			revision: 3,
			idempotencyKey: "decline-exhausted",
			state: "running",
			attempts: 8,
			nextAttemptAt: Date.now() + 60_000,
			createdAt: Date.now(),
		});
		return applicationId;
	});
	await t.mutation(internal.admissions.internal.failOutbox, {
		idempotencyKey: "decline-exhausted",
		error: "Slack unavailable",
		nextAttemptAt: Date.now() + 60_000,
	});
	const alerts = await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect());
	expect(alerts).toHaveLength(1);
	expect(alerts[0]?.text).toContain("Admissions integration retry limit reached");
	expect(alerts[0]?.text).toContain("Høst 2026");
	expect(alerts[0]?.text).toContain(`Slack channel h26-opptak or h26-opptak-${periodId}`);
	expect(alerts[0]?.text).toContain(`owner admissions:${periodId}`);
	expect(alerts[0]?.text).not.toContain("applicant@uio.no");
	expect(alerts[0]?.text).not.toContain("Slack unavailable");
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
});

it("finds an actionable failure beyond old completed history in the admin overview", async () => {
	const { t, admin, periodId } = await recoveryFixture();
	await t.run(async (ctx) => {
		for (let index = 0; index < 205; index++)
			await ctx.db.insert("admissionOutbox", outboxJob(periodId, `done-${index}`, "done", 0));
		await ctx.db.insert(
			"admissionOutbox",
			outboxJob(periodId, "later-failure", "failed", Date.now()),
		);
	});
	const overview = await admin.query(api.admissions.queries.adminOverview, { periodId });
	expect(overview?.jobs.map(({ idempotencyKey }) => idempotencyKey)).toContain("later-failure");
	expect(overview?.jobsTruncated).toEqual({ pending: false, running: false, failed: false });
});

it("keeps retry controls admin-only", async () => {
	const { t, periodId } = await recoveryFixture();
	const student = await insertUser(t, "student@uio.no");
	await t.run((ctx) =>
		ctx.db.insert("admissionOutbox", outboxJob(periodId, "private-job", "failed", Date.now())),
	);
	await expect(
		asUser(t, student).mutation(api.admissions.recovery.retryOutbox, {
			idempotencyKey: "private-job",
		}),
	).rejects.toThrow(/Unauthorized/);
});
