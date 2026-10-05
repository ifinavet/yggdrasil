import { vResultValidator, vWorkflowId } from "@convex-dev/workflow";
import { ConvexError, type Infer, v } from "convex/values";
import { parse } from "convex-helpers/validators";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation, type QueryCtx } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { workflow } from "../lib/workflow";
import { finishClose } from "./lifecycle";
import { MAX_APPLICATIONS } from "./rules";
import { operationValidator } from "./schema";

export type Operation = Infer<typeof operationValidator>;

export const deliver = workflow
	.define({ args: { operation: operationValidator } })
	.handler(async (step, { operation }): Promise<void> => {
		await step.runAction(
			internal.admissions.actions.execute,
			{ operation },
			{
				runAt: operation.dueAt,
				retry: { maxAttempts: 8, initialBackoffMs: 60_000, base: 2 },
			},
		);
	});

export async function startDelivery(ctx: MutationCtx, operation: Operation) {
	const existing = await ctx.db
		.query("admissionWorkflows")
		.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", operation.idempotencyKey))
		.unique();
	if (existing) return existing._id;
	const workflowId = await workflow.start(
		ctx,
		internal.admissions.workflow.deliver,
		{ operation },
		{
			onComplete: internal.admissions.workflow.completed,
			context: operation.idempotencyKey,
		},
	);
	return ctx.db.insert("admissionWorkflows", {
		kind: operation.kind,
		periodId: operation.periodId,
		idempotencyKey: operation.idempotencyKey,
		workflowId,
	});
}

export async function readOperation(ctx: QueryCtx | MutationCtx, ref: Doc<"admissionWorkflows">) {
	const { workflow: run } = await ctx.runQuery(components.workflow.workflow.getStatus, {
		workflowId: ref.workflowId,
	});
	const { operation } = parse(v.object({ operation: operationValidator }), run.args);
	return {
		...operation,
		...ref,
		createdAt: ref._creationTime,
		state: run.runResult?.kind ?? ("inProgress" as const),
		lastError: run.runResult?.kind === "failed" ? run.runResult.error : undefined,
	};
}

export async function listOperations(
	ctx: QueryCtx | MutationCtx,
	periodId: Id<"admissionPeriods">,
	activeOnly = false,
) {
	const query = ctx.db.query("admissionWorkflows");
	const refs = await (activeOnly
		? query.withIndex("by_periodId_and_completedAt", (q) =>
				q.eq("periodId", periodId).eq("completedAt", undefined),
			)
		: query.withIndex("by_periodId", (q) => q.eq("periodId", periodId))
	).take(MAX_APPLICATIONS * 20 + 1);
	if (refs.length > MAX_APPLICATIONS * 20)
		throw new ConvexError("For mange utsendinger i opptaket.");
	return Promise.all(refs.map((ref) => readOperation(ctx, ref)));
}

export const completed = internalMutation({
	args: { workflowId: vWorkflowId, result: vResultValidator, context: v.string() },
	handler: async (ctx, { workflowId, result, context: idempotencyKey }): Promise<void> => {
		const ref = await ctx.db
			.query("admissionWorkflows")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		const period = ref ? await ctx.db.get(ref.periodId) : null;
		if (!period) {
			await workflow.cleanup(ctx, workflowId);
			return;
		}
		if (ref && result.kind !== "failed") await ctx.db.patch(ref._id, { completedAt: Date.now() });
		if (result.kind === "failed") {
			const { workflow: run } = await ctx.runQuery(components.workflow.workflow.getStatus, {
				workflowId,
			});
			const { operation } = parse(v.object({ operation: operationValidator }), run.args);
			await ctx.runMutation(internal.admissions.internal.reportFailure, { operation });
		}
		if (period.status === "closing") await finishClose(ctx, period);
	},
});

export const retry = mutation({
	args: { idempotencyKey: v.string() },
	handler: async (ctx, { idempotencyKey }) => {
		await requireRole(ctx, adminRoles);
		const ref = await ctx.db
			.query("admissionWorkflows")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (!ref) return { queued: false };
		if ((await workflow.status(ctx, ref.workflowId)).type !== "failed") return { queued: false };
		await workflow.restart(ctx, ref.workflowId, { from: 0 });
		return { queued: true };
	},
});
