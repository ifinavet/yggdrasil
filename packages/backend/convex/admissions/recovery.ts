import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { startDelivery } from "./workflow";

export const retryOutbox = mutation({
	args: { idempotencyKey: v.string() },
	handler: async (ctx, { idempotencyKey }) => {
		await requireRole(ctx, adminRoles);
		const job = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (!job) return { queued: false, reason: "missing" as const };
		if (job.workflowId || job.state !== "failed") return { queued: false, reason: job.state };
		const now = Date.now();
		await ctx.db.patch(job._id, {
			state: "pending",
			attempts: 0,
			nextAttemptAt: now,
			lastError: undefined,
		});
		await startDelivery(ctx, job._id, idempotencyKey, now);
		return { queued: true };
	},
});
