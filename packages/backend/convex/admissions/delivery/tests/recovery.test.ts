import { expect, it } from "vitest";
import { admissionPeriodFixture, applicationFields } from "../../../../test/admissions-fixtures";
import {
	allOperations,
	finishOperation,
	stageOperation,
} from "../../../../test/admissions-workflow";
import { asUser, insertUser } from "../../../../test/fixtures";
import { api } from "../../../_generated/api";

async function recoveryFixture() {
	const {
		t,
		adminClient: admin,
		periodId,
	} = await admissionPeriodFixture({ revision: 0, applicationStartAt: Date.now() - 86400000 });
	return { t, admin, periodId };
}

function operationFixture(
	periodId: Awaited<ReturnType<typeof recoveryFixture>>["periodId"],
	idempotencyKey: string,
	state: "inProgress" | "failed" | "success",
	dueAt: number,
) {
	return {
		kind: "archive_channel" as const,
		periodId,
		revision: 0,
		idempotencyKey,
		state,

		dueAt,
	};
}

it("lets admins retry terminal failures without starting concurrent workers", async () => {
	const { t, admin, periodId } = await recoveryFixture();
	const now = Date.now();
	await t.run(async (ctx) => {
		await stageOperation(ctx, operationFixture(periodId, "failed-job", "failed", now));
		await stageOperation(ctx, operationFixture(periodId, "expired-running", "inProgress", now - 1));
		await stageOperation(
			ctx,
			operationFixture(periodId, "active-running", "inProgress", now + 60000),
		);
		await stageOperation(ctx, operationFixture(periodId, "done-job", "success", now));
	});
	await expect(
		admin.mutation(api.admissions.delivery.workflow.retry, { idempotencyKey: "failed-job" }),
	).resolves.toMatchObject({ queued: true });
	await expect(
		admin.mutation(api.admissions.delivery.workflow.retry, { idempotencyKey: "expired-running" }),
	).resolves.toMatchObject({ queued: false });
	await expect(
		admin.mutation(api.admissions.delivery.workflow.retry, { idempotencyKey: "active-running" }),
	).resolves.toMatchObject({ queued: false });
	await expect(
		admin.mutation(api.admissions.delivery.workflow.retry, { idempotencyKey: "done-job" }),
	).resolves.toMatchObject({ queued: false });
	const jobs = await t.run((ctx) => allOperations(ctx));
	expect(jobs.filter((job) => job.state === "inProgress")).toHaveLength(3);
	expect(jobs.find((job) => job.idempotencyKey === "failed-job")?.state).toBe("inProgress");
});

it("alerts #system and purges closing data after cleanup exhausts its retries", async () => {
	const { t, periodId } = await recoveryFixture();
	await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "closing" });
		await stageOperation(ctx, {
			...operationFixture(periodId, "archive-exhausted", "inProgress", Date.now()),
		});
	});
	await finishOperation(t, "archive-exhausted", "Slack unavailable");
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
		await stageOperation(ctx, {
			kind: "offer_declined",
			periodId,
			applicationId,
			revision: 3,
			idempotencyKey: "decline-exhausted",
			state: "inProgress",
			dueAt: Date.now() + 60_000,
		});
		return applicationId;
	});
	await finishOperation(t, "decline-exhausted", "Slack unavailable");
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
			await stageOperation(ctx, operationFixture(periodId, `done-${index}`, "success", 0));
		await stageOperation(ctx, operationFixture(periodId, "later-failure", "failed", Date.now()));
	});
	const overview = await admin.query(api.admissions.queries.adminOverview, { periodId });
	expect(overview?.jobs.map(({ idempotencyKey }) => idempotencyKey)).toContain("later-failure");
}, 20_000);

it("keeps retry controls admin-only", async () => {
	const { t, periodId } = await recoveryFixture();
	const student = await insertUser(t, "student@uio.no");
	await t.run((ctx) =>
		stageOperation(ctx, operationFixture(periodId, "private-job", "failed", Date.now())),
	);
	await expect(
		asUser(t, student).mutation(api.admissions.delivery.workflow.retry, {
			idempotencyKey: "private-job",
		}),
	).rejects.toThrow(/Unauthorized/);
});
