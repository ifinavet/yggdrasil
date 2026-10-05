import { expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

async function recoveryFixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", {
			title: "Høst 2026",
			applicationStartAt: Date.now() - 86400000,
			applicationEndAt: Date.now() + 86400000,
			interviewStartAt: Date.now() + 172800000,
			interviewEndAt: Date.now() + 604800000,
			retentionAt: Date.now() + 1209600000,
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

it("lets admins retry failed jobs and only running jobs with expired leases", async () => {
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
	).resolves.toMatchObject({ queued: true });
	await expect(
		admin.mutation(api.admissions.recovery.retryOutbox, { idempotencyKey: "active-running" }),
	).resolves.toMatchObject({ queued: false, reason: "lease_active" });
	await expect(
		admin.mutation(api.admissions.recovery.retryOutbox, { idempotencyKey: "done-job" }),
	).resolves.toMatchObject({ queued: false, reason: "done" });
	const jobs = await t.run((ctx) => ctx.db.query("admissionOutbox").collect());
	expect(jobs.filter((job) => job.state === "pending")).toHaveLength(2);
	expect(jobs.find((job) => job.idempotencyKey === "failed-job")?.attempts).toBe(0);
});

it("recovers expired outbox leases automatically", async () => {
	const { t, periodId } = await recoveryFixture();
	await t.run(async (ctx) => {
		await ctx.db.insert(
			"admissionOutbox",
			outboxJob(periodId, "expired", "running", Date.now() - 1),
		);
		await ctx.db.insert(
			"admissionOutbox",
			outboxJob(periodId, "still-leased", "running", Date.now() + 60000),
		);
		await ctx.db.insert("admissionOutbox", {
			...outboxJob(periodId, "maxed-lease", "running", Date.now() - 1),
			attempts: 8,
		});
		await ctx.db.insert("admissionOutbox", {
			...outboxJob(periodId, "terminal-failure", "failed", Date.now() - 1),
			attempts: 8,
		});
	});
	await t.mutation(internal.admissions.recovery.recoverPeriod, { periodId });
	const jobs = await t.run((ctx) => ctx.db.query("admissionOutbox").collect());
	expect(jobs.find((job) => job.idempotencyKey === "expired")?.state).toBe("pending");
	expect(jobs.find((job) => job.idempotencyKey === "still-leased")?.state).toBe("running");
	expect(jobs.find((job) => job.idempotencyKey === "maxed-lease")?.state).toBe("failed");
	expect(jobs.find((job) => job.idempotencyKey === "terminal-failure")?.state).toBe("failed");
});

it("sets a five-minute lease when a worker claims an outbox job", async () => {
	const { t, periodId } = await recoveryFixture();
	await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "closing" });
		await ctx.db.insert("admissionOutbox", {
			...outboxJob(periodId, "archive-now", "pending", Date.now()),
			kind: "archive_channel",
		});
	});
	const beforeClaim = Date.now();
	await t.mutation(internal.admissions.internal.claimOutbox, { idempotencyKey: "archive-now" });
	const claimed = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", "archive-now"))
			.unique(),
	);
	expect(claimed).toMatchObject({ state: "running" });
	expect(claimed?.nextAttemptAt).toBeGreaterThanOrEqual(beforeClaim + 5 * 60_000);
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
		const applicationId = await ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 2,
			decisionRevision: 3,
			decision: "accepted",
			decisionSentAt: Date.now() - 1_000,
			offerStatus: "declined",
			sent: true,
		});
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

it("recovers only the active period and stops scheduling after its deletion", async () => {
	const { t, periodId } = await recoveryFixture();
	const due = Date.now() - 1;
	await t.run(async (ctx) => {
		const period = await ctx.db.get(periodId);
		if (!period) throw new Error("Missing test period");
		const { _id, _creationTime, ...fields } = period;
		const otherId = await ctx.db.insert("admissionPeriods", fields);
		await ctx.db.insert("admissionOutbox", outboxJob(periodId, "current-period", "running", due));
		await ctx.db.insert("admissionOutbox", outboxJob(otherId, "other-period", "running", due));
	});
	expect(await t.mutation(internal.admissions.recovery.recoverPeriod, { periodId })).toBe(1);
	const jobs = await t.run((ctx) => ctx.db.query("admissionOutbox").collect());
	expect(jobs.find((job) => job.idempotencyKey === "current-period")?.state).toBe("pending");
	expect(jobs.find((job) => job.idempotencyKey === "other-period")?.state).toBe("running");
	const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
	expect(scheduled.some((job) => job.name.includes("recoverPeriod"))).toBe(true);
	await t.run((ctx) => ctx.db.delete(periodId));
	expect(await t.mutation(internal.admissions.recovery.recoverPeriod, { periodId })).toBe(0);
	expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(
		scheduled.length,
	);
});
