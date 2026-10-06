import { afterEach, expect, it, vi } from "vitest";
import {
	applicationFields,
	firstAdmissionOperation,
	interviewFields,
	periodFields,
} from "../../../test/admissions-fixtures";
import {
	deliveryContext,
	finishOperation,
	operationByKey,
	stageOperation,
} from "../../../test/admissions-workflow";
import { asUser, grantRole, insertUser, setup } from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { finishClose } from "../lifecycle";

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

type TestConvex = Awaited<ReturnType<typeof setup>>["t"];

async function seedClosingPeriod(
	t: TestConvex,
	adminId: Id<"users">,
	applicantId: Id<"users">,
	stage: (
		ctx: MutationCtx,
		periodId: Id<"admissionPeriods">,
		applicationId: Id<"admissionApplications">,
	) => Promise<void>,
	period: Partial<Doc<"admissionPeriods">> = {},
) {
	return await t.run(async (ctx) => {
		const periodId = await ctx.db.insert("admissionPeriods", periodFields(adminId, period));
		const applicationId = await ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicantId),
		);
		await stage(ctx, periodId, applicationId);
		await ctx.db.patch(periodId, { status: "closing" });
		return { periodId, applicationId };
	});
}

async function expectCloseBlocked(t: TestConvex, periodId: Id<"admissionPeriods">) {
	expect(
		await t.run(async (ctx) => {
			const period = await ctx.db.get(periodId);
			if (!period) throw new Error("Missing closing period");
			return finishClose(ctx, period);
		}),
	).toBe(false);
}

async function failedArchive(ctx: MutationCtx, periodId: Id<"admissionPeriods">, key: string) {
	await stageOperation(ctx, {
		kind: "archive_channel",
		periodId,
		revision: 2,
		idempotencyKey: key,
		dueAt: Date.now(),
		state: "failed",
	});
}

it("preserves closing data while a failed archive still needs retry", async () => {
	vi.useFakeTimers();
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "applicant@uio.no");
	const { periodId, applicationId } = await seedClosingPeriod(
		t,
		admin._id,
		applicant._id,
		(ctx, id) => failedArchive(ctx, id, "archive-retryable"),
	);

	await expectCloseBlocked(t, periodId);
	expect(await t.run((ctx) => ctx.db.get(periodId))).not.toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	expect(await t.run((ctx) => operationByKey(ctx, "archive-retryable"))).toMatchObject({
		state: "failed",
	});

	await asUser(t, admin).mutation(api.admissions.delivery.workflow.retry, {
		idempotencyKey: "archive-retryable",
	});
	await finishOperation(t, "archive-retryable");
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
});

it("rechecks a failed archive at retention and then purges closing data", async () => {
	vi.useFakeTimers();
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const applicant = await insertUser(t, "applicant@uio.no");
	const retentionAt = Date.now() + 1_000;
	const { periodId, applicationId } = await seedClosingPeriod(
		t,
		admin._id,
		applicant._id,
		(ctx, id) => failedArchive(ctx, id, "archive-expires-at-retention"),
		{ retentionAt },
	);

	await expectCloseBlocked(t, periodId);
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	vi.setSystemTime(retentionAt);
	expect(await t.mutation(internal.admissions.internal.closeExpiredPeriod, { periodId })).toBe(
		true,
	);
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
});

it("waits for a failed interview cancellation before queueing archive", async () => {
	vi.useFakeTimers();
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "applicant@uio.no");
	const { periodId, applicationId } = await seedClosingPeriod(
		t,
		admin._id,
		applicant._id,
		async (ctx, periodId, applicationId) => {
			const interviewId = await ctx.db.insert(
				"admissionInterviews",
				interviewFields(periodId, applicationId, { status: "cancelled", revision: 2 }),
			);
			await stageOperation(ctx, {
				kind: "cancel_interview",
				periodId,
				applicationId,
				interviewId,
				revision: 2,
				idempotencyKey: "cancel-retryable",
				dueAt: Date.now(),
				state: "failed",
			});
		},
	);

	await expectCloseBlocked(t, periodId);
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	expect(await t.run((ctx) => operationByKey(ctx, "cancel-retryable"))).toMatchObject({
		state: "failed",
	});

	await asUser(t, admin).mutation(api.admissions.delivery.workflow.retry, {
		idempotencyKey: "cancel-retryable",
	});
	await finishOperation(t, "cancel-retryable");
	expect(await firstAdmissionOperation(t, periodId, "cancel_interview")).toMatchObject({
		state: "success",
	});
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toMatchObject({
		state: "inProgress",
	});
});

it("keeps closing data until an already-running decision and reminder settle", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const applicant = await insertUser(t, "applicant@uio.no");
	const { periodId, applicationId } = await t.run(async (ctx) => {
		const periodId = await ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, { status: "closing" }),
		);
		const applicationId = await ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicant._id, {
				decisionRevision: 1,
				decision: "accepted",
				offerStatus: "pending",
			}),
		);
		const jobs = [
			{
				kind: "send_decision" as const,
				applicationId,
				idempotencyKey: "decision-running",
			},
			{ kind: "remind_1d" as const, idempotencyKey: "reminder-running" },
			{
				kind: "archive_channel" as const,
				idempotencyKey: "archive-done",
				state: "success" as const,
			},
		];
		for (const job of jobs)
			await stageOperation(ctx, {
				...job,
				periodId,
				revision: 1,
				state: job.state ?? "inProgress",
				dueAt: Date.now(),
			});
		return { periodId, applicationId };
	});

	await finishOperation(t, "decision-running");
	expect(await t.run((ctx) => ctx.db.get(periodId))).not.toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();

	await finishOperation(t, "reminder-running");
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
});

it("sends a declined-offer notice before archiving the channel during close", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "applicant@uio.no");
	const { periodId, applicationId } = await t.run(async (ctx) => {
		const now = Date.now();
		const periodId = await ctx.db.insert("admissionPeriods", periodFields(admin._id));
		const applicationId = await ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicant._id, {
				revision: 2,
				decisionRevision: 3,
				decision: "accepted",
				decisionSentAt: now - 1_000,
				offerStatus: "declined",
			}),
		);
		await stageOperation(ctx, {
			kind: "offer_declined",
			periodId,
			applicationId,
			revision: 3,
			idempotencyKey: "declined-before-close",
			state: "inProgress",
			dueAt: now,
		});
		return { periodId, applicationId };
	});

	await asUser(t, admin).mutation(api.admissions.mutations.closePeriod, {
		periodId,
		force: true,
	});
	const claimed = await deliveryContext(t, "declined-before-close");
	expect(claimed?.job.idempotencyKey).toBe("declined-before-close");
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toBeNull();

	await finishOperation(t, "declined-before-close");
	expect(await firstAdmissionOperation(t, periodId, "offer_declined")).toMatchObject({
		applicationId,
		state: "success",
	});
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toMatchObject({
		kind: "archive_channel",
		state: "inProgress",
	});
});
