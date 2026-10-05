import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { workflow } from "../lib/workflow";
import { listOperations, readOperation, startDelivery } from "./delivery/workflow";
import { MAX_APPLICATIONS } from "./rules";

export async function beginClose(
	ctx: MutationCtx,
	period: Doc<"admissionPeriods">,
	force: boolean,
	key: string,
) {
	const applications = await ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", period._id).eq("status", "submitted"),
		)
		.take(MAX_APPLICATIONS);
	const interviews = await ctx.db
		.query("admissionInterviews")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", period._id).eq("status", "scheduled"),
		)
		.take(MAX_APPLICATIONS);
	const pendingOffers = applications.filter((app) => app.offerStatus === "pending");
	const unsentDecisions = applications.filter(
		(app) => (app.decision === "accepted" || app.decision === "rejected") && !app.decisionSentAt,
	);
	const now = Date.now();
	if (
		!force &&
		(pendingOffers.length ||
			interviews.some((interview) => interview.startAt > now) ||
			unsentDecisions.length)
	)
		throw new ConvexError(
			`Før du lukker, avklar ${pendingOffers.length} ventende tilbud, ${interviews.length} intervjuer og ${unsentDecisions.length} usendte beslutninger.`,
		);
	const publishing = await activePublishInterviewIds(ctx, period._id, true);
	await Promise.all(
		pendingOffers.map((app) =>
			ctx.db.patch(app._id, { offerStatus: "expired", revision: app.revision + 1 }),
		),
	);
	await Promise.all(
		interviews.map(async (interview) => {
			const revision = interview.revision + 1;
			await ctx.db.patch(interview._id, { status: "cancelled", revision, publishedAt: undefined });
			if (interview.publishedAt || interview.calendarEventId || publishing.has(interview._id))
				await startDelivery(ctx, {
					kind: "cancel_interview",
					periodId: period._id,
					applicationId: interview.applicationId,
					interviewId: interview._id,
					revision,
					idempotencyKey: `${key}:cancel:${interview._id}`,
					dueAt: now,
					notifyApplicant: Boolean(interview.publishedAt && interview.startAt > now),
				});
		}),
	);
	const closing = { ...period, status: "closing" as const, revision: period.revision + 1 };
	await ctx.db.patch(period._id, { status: closing.status, revision: closing.revision });
	await finishClose(ctx, closing);
}

export async function purgeBatch(ctx: MutationCtx, periodId: Id<"admissionPeriods">) {
	const queries = [
		ctx.db.query("admissionDeliveries").withIndex("by_periodId", (q) => q.eq("periodId", periodId)),
		ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) => q.eq("periodId", periodId)),
		ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) => q.eq("periodId", periodId)),
		ctx.db.query("admissionWorkflows").withIndex("by_periodId", (q) => q.eq("periodId", periodId)),
	];
	for (const query of queries) {
		const rows = await query.take(80);
		await Promise.all(
			rows.map(async (row) => {
				await ctx.db.delete(row._id);
				if ("workflowId" in row) {
					if ((await workflow.status(ctx, row.workflowId)).type === "inProgress")
						await workflow.cancel(ctx, row.workflowId);
					else await workflow.cleanup(ctx, row.workflowId);
				}
			}),
		);
		if (rows.length === 80) {
			await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
			return false;
		}
	}
	await ctx.db.delete(periodId);
	return true;
}

export async function finishClose(ctx: MutationCtx, period: Doc<"admissionPeriods">) {
	const jobs = await listOperations(ctx, period._id, true);
	const cleanup = new Set(["cancel_interview", "publish", "offer_declined", "archive_channel"]);
	if (
		jobs.some(
			(job) => job.state === "inProgress" && (cleanup.has(job.kind) || job.dueAt <= Date.now()),
		)
	)
		return false;
	const archiveKey = `close-archive:${period._id}`;
	const archive = await ctx.db
		.query("admissionWorkflows")
		.withIndex("by_periodId_and_kind", (q) =>
			q.eq("periodId", period._id).eq("kind", "archive_channel"),
		)
		.first();
	if (!archive) {
		await startDelivery(ctx, {
			kind: "archive_channel",
			periodId: period._id,
			revision: period.revision,
			idempotencyKey: archiveKey,
			dueAt: Date.now(),
		});
		return false;
	}
	if ((await readOperation(ctx, archive)).state === "inProgress") return false;
	await purgeBatch(ctx, period._id);
	return true;
}

export async function activePublishInterviewIds(
	ctx: MutationCtx,
	periodId: Id<"admissionPeriods">,
	includeFailed = false,
) {
	const jobs = await listOperations(ctx, periodId, true);
	return new Set(
		jobs
			.filter(
				(job) =>
					job.kind === "publish" &&
					(job.state === "inProgress" || (includeFailed && job.state === "failed")),
			)
			.flatMap((job) => (job.interviewId ? [job.interviewId] : [])),
	);
}
