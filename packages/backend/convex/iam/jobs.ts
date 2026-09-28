import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";

const WATCH_AFTER_MS = 11 * 60 * 1000;

export const STALLED_MESSAGE = "Jobben stoppet før den ble ferdig. Prøv igjen.";

export async function runJob(
	ctx: Pick<MutationCtx, "scheduler">,
	job: "provision" | "offboard",
	accountId: Id<"memberAccounts">,
) {
	const jobId = await ctx.scheduler.runAfter(0, internal.iam.actions[job], { accountId });
	await ctx.scheduler.runAfter(WATCH_AFTER_MS, internal.iam.jobs.watch, { accountId, jobId });
}

export const watch = internalMutation({
	args: { accountId: v.id("memberAccounts"), jobId: v.id("_scheduled_functions") },
	handler: async (ctx, args) => {
		const job = await ctx.db.system.get(args.jobId);
		const state = job?.state.kind;
		if (state === "pending" || state === "inProgress") {
			await ctx.scheduler.runAfter(WATCH_AFTER_MS, internal.iam.jobs.watch, args);
			return;
		}
		if (state !== "failed" && state !== "canceled") return;
		const account = await ctx.db.get(args.accountId);
		if (!account || account.lastError) return;
		await ctx.db.patch(account._id, { lastError: STALLED_MESSAGE, updatedAt: Date.now() });
	},
});
