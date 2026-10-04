import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { enqueueSystemMessage } from "../iam/notifications";
import { finishClose } from "./lifecycle";

const RECOVERY_BATCH = 100;
const recoverableStates = ["pending", "running"] as const;

export const retryOutbox = mutation({
	args: { idempotencyKey: v.string() },
	handler: async (ctx, { idempotencyKey }) => {
		await requireRole(ctx, adminRoles);
		const job = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (!job) return { queued: false, reason: "missing" as const };
		if (job.state === "done") return { queued: false, reason: "done" as const };
		if (job.state === "pending") return { queued: false, reason: "pending" as const };
		if (job.state === "running" && job.nextAttemptAt > Date.now())
			return { queued: false, reason: "lease_active" as const };
		await enqueueRetry(ctx, job);
		return { queued: true };
	},
});

export const recoverExpired = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const batches = await Promise.all(
			recoverableStates.map((state) =>
				ctx.db
					.query("admissionOutbox")
					.withIndex("by_state_and_nextAttemptAt", (q) =>
						q.eq("state", state).lte("nextAttemptAt", now),
					)
					.take(RECOVERY_BATCH),
			),
		);
		const jobs = batches.flat();
		await Promise.all(jobs.map((job) => recoverJob(ctx, job, now)));
		return jobs.length;
	},
});

async function enqueueRetry(ctx: MutationCtx, job: Doc<"admissionOutbox">) {
	const now = Date.now();
	await ctx.db.patch(job._id, {
		state: "pending",
		attempts: 0,
		nextAttemptAt: now,
	});
	await ctx.scheduler.runAfter(0, internal.admissions.actions.processOutbox, {
		idempotencyKey: job.idempotencyKey,
	});
}

async function recoverJob(ctx: MutationCtx, job: Doc<"admissionOutbox">, now: number) {
	const latest = await ctx.db.get(job._id);
	if (!latest || latest.state !== job.state || latest.nextAttemptAt > now) return;
	if (latest.state === "running" && latest.attempts >= 8) {
		await ctx.db.patch(latest._id, {
			state: "failed",
			lastError: "Worker lease expired after eight attempts; manual retry required.",
		});
		if (latest.kind === "cancel_interview" || latest.kind === "archive_channel")
			await enqueueSystemMessage(ctx, {
				channel: SYSTEM_ALERTS_CHANNEL,
				text: "An admissions cleanup job reached its retry limit. Review admissions operations.",
				clientMsgId: `admissions-cleanup-exhausted:${latest._id}`,
			});
		const period = await ctx.db.get(latest.periodId);
		if (period?.status === "closing") await finishClose(ctx, period);
		return;
	}
	await ctx.db.patch(latest._id, {
		state: "pending",
		nextAttemptAt: now,
		...(latest.state === "running" && {
			lastError: "Worker lease expired; retry scheduled.",
		}),
	});
	await ctx.scheduler.runAfter(0, internal.admissions.actions.processOutbox, {
		idempotencyKey: latest.idempotencyKey,
	});
}
