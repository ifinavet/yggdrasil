import { components, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../convex/_generated/server";
import {
	listOperations,
	type Operation,
	readOperation,
	startDelivery,
} from "../convex/admissions/workflow";
import type { TestBackend } from "./fixtures";

export async function allOperations(ctx: QueryCtx) {
	const refs = await ctx.db.query("admissionWorkflows").collect();
	return await Promise.all(refs.map((ref) => readOperation(ctx, ref)));
}
export async function operationByKey(ctx: QueryCtx, key: string) {
	const ref = await ctx.db
		.query("admissionWorkflows")
		.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key))
		.unique();
	return ref ? readOperation(ctx, ref) : null;
}
export async function firstOperation(
	ctx: QueryCtx,
	periodId: Id<"admissionPeriods">,
	kind: Operation["kind"],
) {
	return (await listOperations(ctx, periodId)).find((operation) => operation.kind === kind) ?? null;
}
export async function stageOperation(
	ctx: MutationCtx,
	input: Operation & { state?: "inProgress" | "success" | "failed" | "canceled" },
) {
	const { state, ...operation } = input;
	const id = await startDelivery(ctx, operation);
	if (state && state !== "inProgress") {
		const ref = await ctx.db.get(id);
		if (!ref) throw new Error("Missing workflow reference");
		const { workflow } = await ctx.runQuery(components.workflow.workflow.getStatus, {
			workflowId: ref.workflowId,
		});
		await ctx.runMutation(components.workflow.workflow.complete, {
			workflowId: ref.workflowId,
			generationNumber: workflow.generationNumber,
			runResult:
				state === "success"
					? { kind: "success", returnValue: null }
					: state === "failed"
						? { kind: "failed", error: "Provider unavailable" }
						: { kind: "canceled" },
		});
	}
	return id;
}
export async function operationArgs(t: TestBackend, key: string): Promise<Operation> {
	const job = await t.run((ctx) => operationByKey(ctx, key));
	if (!job) throw new Error(`Missing operation ${key}`);
	const { _id, _creationTime, workflowId, createdAt, completedAt, state, lastError, ...operation } =
		job;
	return operation;
}
export async function deliveryContext(t: TestBackend, key: string) {
	return t.query(internal.admissions.internal.deliveryContext, {
		operation: await operationArgs(t, key),
	});
}
export async function finishOperation(t: TestBackend, key: string, failure?: string) {
	const operation = await operationArgs(t, key);
	if (!failure) await t.mutation(internal.admissions.internal.completeDelivery, { operation });
	await t.run(async (ctx) => {
		const ref = await ctx.db
			.query("admissionWorkflows")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key))
			.unique();
		if (!ref) return;
		const { workflow } = await ctx.runQuery(components.workflow.workflow.getStatus, {
			workflowId: ref.workflowId,
		});
		if (!workflow.runResult)
			await ctx.runMutation(components.workflow.workflow.complete, {
				workflowId: ref.workflowId,
				generationNumber: workflow.generationNumber,
				runResult: failure
					? { kind: "failed", error: failure }
					: { kind: "success", returnValue: null },
			});
	});
}
