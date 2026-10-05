import { vResultValidator, vWorkflowId, WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { MAX_OUTBOX_ATTEMPTS } from "./rules";

const workflow = new WorkflowManager(components.workflow, {
	workpoolOptions: { maxParallelism: 10 },
});

export const deliver = workflow
	.define({ args: { idempotencyKey: v.string(), dueAt: v.number() } })
	.handler(async (step, { idempotencyKey, dueAt }): Promise<void> => {
		await step.runAction(
			internal.admissions.actions.processOutbox,
			{ idempotencyKey },
			{
				runAt: dueAt,
				retry: { maxAttempts: MAX_OUTBOX_ATTEMPTS, initialBackoffMs: 60_000, base: 2 },
			},
		);
	});

export async function startDelivery(
	ctx: MutationCtx,
	jobId: Id<"admissionOutbox">,
	idempotencyKey: string,
	dueAt: number,
) {
	const workflowId = await workflow.start(
		ctx,
		internal.admissions.workflow.deliver,
		{ idempotencyKey, dueAt },
		{
			onComplete: internal.admissions.workflow.completed,
			context: idempotencyKey,
		},
	);
	await ctx.db.patch(jobId, { workflowId });
}

export const completed = internalMutation({
	args: { workflowId: vWorkflowId, result: vResultValidator, context: v.string() },
	handler: async (ctx, { workflowId, result, context: idempotencyKey }): Promise<void> => {
		if (result.kind !== "success")
			await ctx.runMutation(internal.admissions.internal.failOutbox, {
				idempotencyKey,
				error: "Utsendingen kunne ikke fullføres. Prøv igjen eller følg opp manuelt.",
				nextAttemptAt: Date.now(),
				terminal: true,
			});
		const job = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (job?.workflowId === workflowId) await ctx.db.patch(job._id, { workflowId: undefined });
		await workflow.cleanup(ctx, workflowId);
	},
});
