import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_APPLICATIONS, MAX_OUTBOX_ATTEMPTS } from "./rules";

type CleanupKind = "cancel_interview" | "publish" | "offer_declined" | "archive_channel";

export async function queueOutbox(
	ctx: MutationCtx,
	fields: Omit<Doc<"admissionOutbox">, "_id" | "_creationTime">,
) {
	const existing = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", fields.idempotencyKey))
		.unique();
	if (existing) return existing._id;
	const jobId = await ctx.db.insert("admissionOutbox", fields);
	await ctx.scheduler.runAfter(
		Math.max(0, fields.nextAttemptAt - Date.now()),
		internal.admissions.actions.processOutbox,
		{ idempotencyKey: fields.idempotencyKey },
	);
	return jobId;
}

export async function purgeBatch(ctx: MutationCtx, periodId: Id<"admissionPeriods">) {
	const deliveries = await ctx.db
		.query("admissionDeliveries")
		.withIndex("by_periodId", (q) => q.eq("periodId", periodId))
		.take(80);
	await Promise.all(deliveries.map((row) => ctx.db.delete(row._id)));
	if (deliveries.length === 80) {
		await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
		return false;
	}
	const interviews = await ctx.db
		.query("admissionInterviews")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "cancelled"),
		)
		.take(80);
	await Promise.all(interviews.map((row) => ctx.db.delete(row._id)));
	const scheduled = await ctx.db
		.query("admissionInterviews")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "scheduled"),
		)
		.take(80);
	await Promise.all(scheduled.map((row) => ctx.db.delete(row._id)));
	if (interviews.length + scheduled.length >= 80) {
		await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
		return false;
	}
	const applications = await ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) => q.eq("periodId", periodId).eq("status", "draft"))
		.take(80);
	await Promise.all(applications.map((row) => ctx.db.delete(row._id)));
	const submitted = await ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "submitted"),
		)
		.take(80);
	await Promise.all(submitted.map((row) => ctx.db.delete(row._id)));
	const withdrawn = await ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "withdrawn"),
		)
		.take(80);
	await Promise.all(withdrawn.map((row) => ctx.db.delete(row._id)));
	if (applications.length + submitted.length + withdrawn.length >= 80) {
		await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
		return false;
	}
	const jobs = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_periodId", (q) => q.eq("periodId", periodId))
		.take(80);
	await Promise.all(jobs.map((row) => ctx.db.delete(row._id)));
	if (jobs.length === 80) {
		await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
		return false;
	}
	await ctx.db.delete(periodId);
	return true;
}

export async function finishClose(ctx: MutationCtx, period: Doc<"admissionPeriods">) {
	if (await hasRunningOutbox(ctx, period._id)) return false;
	if (await hasUnfinishedCleanup(ctx, period._id, "cancel_interview")) return false;
	if (await hasUnfinishedCleanup(ctx, period._id, "publish")) return false;
	if (await hasUnfinishedCleanup(ctx, period._id, "offer_declined")) return false;
	const archive = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_periodId_and_kind", (q) =>
			q.eq("periodId", period._id).eq("kind", "archive_channel"),
		)
		.take(1);
	if (!archive.length) {
		await queueArchiveWhenReady(ctx, period, `close-archive:${period._id}`);
		return false;
	}
	if (await hasUnfinishedCleanup(ctx, period._id, "archive_channel")) return false;
	await purgeBatch(ctx, period._id);
	return true;
}

export async function activePublishInterviewIds(
	ctx: MutationCtx,
	periodId: Id<"admissionPeriods">,
) {
	const [pending, running, retryable] = await Promise.all([
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId_and_kind_and_state", (q) =>
				q.eq("periodId", periodId).eq("kind", "publish").eq("state", "pending"),
			)
			.take(MAX_APPLICATIONS + 1),
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId_and_kind_and_state", (q) =>
				q.eq("periodId", periodId).eq("kind", "publish").eq("state", "running"),
			)
			.take(MAX_APPLICATIONS + 1),
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId_and_kind_and_state_and_attempts", (q) =>
				q
					.eq("periodId", periodId)
					.eq("kind", "publish")
					.eq("state", "failed")
					.lt("attempts", MAX_OUTBOX_ATTEMPTS),
			)
			.take(MAX_APPLICATIONS + 1),
	]);
	const jobs = [...pending, ...running, ...retryable];
	if (jobs.length > MAX_APPLICATIONS * 3)
		throw new ConvexError("For mange publiseringsjobber i opptaket.");
	return new Set(jobs.flatMap((job) => (job.interviewId ? [job.interviewId] : [])));
}

export async function queueArchiveWhenReady(
	ctx: MutationCtx,
	period: Doc<"admissionPeriods">,
	key: string,
	now = Date.now(),
) {
	if (await hasRunningOutbox(ctx, period._id)) return false;
	if (await hasUnfinishedCleanup(ctx, period._id, "cancel_interview")) return false;
	if (await hasUnfinishedCleanup(ctx, period._id, "publish")) return false;
	if (await hasUnfinishedCleanup(ctx, period._id, "offer_declined")) return false;
	const archive = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_periodId_and_kind", (q) =>
			q.eq("periodId", period._id).eq("kind", "archive_channel"),
		)
		.take(1);
	if (archive.length) return true;
	await queueOutbox(ctx, {
		kind: "archive_channel",
		periodId: period._id,
		revision: period.revision,
		idempotencyKey: key,
		state: "pending",
		attempts: 0,
		nextAttemptAt: now,
		createdAt: now,
	});
	return true;
}

async function hasRunningOutbox(ctx: MutationCtx, periodId: Id<"admissionPeriods">) {
	const jobs = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_periodId_and_state", (q) => q.eq("periodId", periodId).eq("state", "running"))
		.take(1);
	return jobs.length > 0;
}

async function hasUnfinishedCleanup(
	ctx: MutationCtx,
	periodId: Id<"admissionPeriods">,
	kind: CleanupKind,
) {
	const [pending, running, retryable] = await Promise.all([
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId_and_kind_and_state", (q) =>
				q.eq("periodId", periodId).eq("kind", kind).eq("state", "pending"),
			)
			.take(1),
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId_and_kind_and_state", (q) =>
				q.eq("periodId", periodId).eq("kind", kind).eq("state", "running"),
			)
			.take(1),
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId_and_kind_and_state_and_attempts", (q) =>
				q
					.eq("periodId", periodId)
					.eq("kind", kind)
					.eq("state", "failed")
					.lt("attempts", MAX_OUTBOX_ATTEMPTS),
			)
			.take(1),
	]);
	return pending.length > 0 || running.length > 0 || retryable.length > 0;
}
