import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

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
	for (const row of deliveries) await ctx.db.delete(row._id);
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
	for (const row of interviews) await ctx.db.delete(row._id);
	const scheduled = await ctx.db
		.query("admissionInterviews")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "scheduled"),
		)
		.take(80);
	for (const row of scheduled) await ctx.db.delete(row._id);
	if (interviews.length + scheduled.length >= 80) {
		await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
		return false;
	}
	const applications = await ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) => q.eq("periodId", periodId).eq("status", "draft"))
		.take(80);
	for (const row of applications) await ctx.db.delete(row._id);
	const submitted = await ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "submitted"),
		)
		.take(80);
	for (const row of submitted) await ctx.db.delete(row._id);
	const withdrawn = await ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "withdrawn"),
		)
		.take(80);
	for (const row of withdrawn) await ctx.db.delete(row._id);
	if (applications.length + submitted.length + withdrawn.length >= 80) {
		await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
		return false;
	}
	const jobs = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_periodId", (q) => q.eq("periodId", periodId))
		.take(80);
	for (const row of jobs) await ctx.db.delete(row._id);
	if (jobs.length === 80) {
		await ctx.scheduler.runAfter(0, internal.admissions.internal.purgeBatch, { periodId });
		return false;
	}
	await ctx.db.delete(periodId);
	return true;
}

export async function finishClose(ctx: MutationCtx, period: Doc<"admissionPeriods">) {
	const unfinished = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_periodId", (q) => q.eq("periodId", period._id))
		.take(200);
	if (
		unfinished.some(
			(job) =>
				job.state === "pending" ||
				job.state === "running" ||
				(job.state === "failed" && job.attempts < 8),
		)
	)
		return false;
	await purgeBatch(ctx, period._id);
	return true;
}

export async function queueArchiveWhenReady(
	ctx: MutationCtx,
	period: Doc<"admissionPeriods">,
	key: string,
	now = Date.now(),
) {
	const cleanup = await ctx.db
		.query("admissionOutbox")
		.withIndex("by_periodId", (q) => q.eq("periodId", period._id))
		.take(200);
	if (
		cleanup.some(
			(job) =>
				job.kind === "cancel_interview" &&
				(job.state === "pending" ||
					job.state === "running" ||
					(job.state === "failed" && job.attempts < 8)),
		)
	)
		return false;
	if (cleanup.some((job) => job.kind === "archive_channel")) return true;
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
