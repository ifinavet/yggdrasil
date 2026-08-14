import type { ObjectType, PropertyValidators } from "convex/values";
import { v } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "../_generated/server";

/**
 * Tracing utilities that add Axiom-compatible end-to-end tracing to Convex
 * functions.
 *
 * Convex log streams forward every `console.*` call to Axiom as a `console`
 * event whose payload lands in `data.message`. We emit a single JSON line per
 * span so it can be parsed in Axiom with `parse_json` and correlated across
 * scheduler / `runMutation` boundaries via a shared `traceId` (Convex's own
 * `request_id` does not span scheduled functions or crons).
 *
 * Mutations and actions consume an optional `traceId` argument so a single
 * trace flows through scheduled emails, point mutations, and waitlist crons.
 * Queries are read-only entry points that never continue an upstream trace, so
 * their wrappers generate a fresh id and add no argument (which also keeps
 * client `useQuery(...)` call sites for no-argument queries untouched).
 */

export type TraceLevel = "INFO" | "WARN" | "ERROR";

/**
 * Structured logger injected into a traced function's context. Each call emits
 * one JSON log line tagged with the active `traceId`.
 */
export type Tracer = (span: string, metadata?: Record<string, unknown>, level?: TraceLevel) => void;

export type TracedQueryCtx = QueryCtx & { traceId: string; trace: Tracer };
export type TracedMutationCtx = MutationCtx & { traceId: string; trace: Tracer };
export type TracedActionCtx = ActionCtx & { traceId: string; trace: Tracer };

const TRACE_TOPIC = "registration_trace";

/**
 * The optional correlation id that flows between traced mutations/actions.
 * Entry points (client calls, crons) omit it and a fresh id is generated;
 * downstream scheduled/internal calls forward `ctx.traceId` to keep the trace.
 */
const traceIdArg = { traceId: v.optional(v.string()) };

function emitTrace(
	traceId: string,
	span: string,
	level: TraceLevel,
	metadata?: Record<string, unknown>,
): void {
	const line = JSON.stringify({
		topic: TRACE_TOPIC,
		traceId,
		span,
		level,
		...(metadata !== undefined ? { metadata } : {}),
	});

	if (level === "ERROR") {
		console.error(line);
	} else if (level === "WARN") {
		console.warn(line);
	} else {
		console.log(line);
	}
}

function makeTracer(traceId: string): Tracer {
	return (span, metadata, level = "INFO") => emitTrace(traceId, span, level, metadata);
}

function resolveTraceId(traceId?: string): string {
	return traceId ?? crypto.randomUUID();
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Wraps a handler invocation with `start`/`success`/`error` spans. `timed` is
 * disabled for queries to avoid `Date.now()` (which breaks query caching).
 */
async function withSpans<Output>(
	trace: Tracer,
	timed: boolean,
	run: () => Output | Promise<Output>,
): Promise<Output> {
	const startedAt = timed ? Date.now() : 0;
	trace("start");
	try {
		const result = await run();
		trace("success", timed ? { durationMs: Date.now() - startedAt } : undefined);
		return result;
	} catch (error) {
		trace(
			"error",
			timed
				? { durationMs: Date.now() - startedAt, error: errorMessage(error) }
				: { error: errorMessage(error) },
			"ERROR",
		);
		throw error;
	}
}

/**
 * Defines a public query with end-to-end tracing. Logs `start`/`success`/
 * `error` spans and exposes `ctx.traceId` + `ctx.trace` to the handler.
 */
export function tracedQuery<
	ArgsValidator extends PropertyValidators = Record<string, never>,
	Output = unknown,
>(fn: {
	args?: ArgsValidator;
	handler: (ctx: TracedQueryCtx, args: ObjectType<ArgsValidator>) => Output | Promise<Output>;
}) {
	return query({
		args: { ...((fn.args ?? {}) as ArgsValidator) },
		handler: async (ctx, ...rest: unknown[]) => {
			const id = resolveTraceId();
			const tracedCtx = { ...ctx, traceId: id, trace: makeTracer(id) } as unknown as TracedQueryCtx;
			return withSpans(tracedCtx.trace, false, () =>
				fn.handler(tracedCtx, (rest[0] ?? {}) as ObjectType<ArgsValidator>),
			);
		},
	});
}

/** Defines an internal query with end-to-end tracing. */
export function tracedInternalQuery<
	ArgsValidator extends PropertyValidators = Record<string, never>,
	Output = unknown,
>(fn: {
	args?: ArgsValidator;
	handler: (ctx: TracedQueryCtx, args: ObjectType<ArgsValidator>) => Output | Promise<Output>;
}) {
	return internalQuery({
		args: { ...((fn.args ?? {}) as ArgsValidator) },
		handler: async (ctx, ...rest: unknown[]) => {
			const id = resolveTraceId();
			const tracedCtx = { ...ctx, traceId: id, trace: makeTracer(id) } as unknown as TracedQueryCtx;
			return withSpans(tracedCtx.trace, false, () =>
				fn.handler(tracedCtx, (rest[0] ?? {}) as ObjectType<ArgsValidator>),
			);
		},
	});
}

/** Defines a public mutation with end-to-end tracing. */
export function tracedMutation<
	ArgsValidator extends PropertyValidators = Record<string, never>,
	Output = unknown,
>(fn: {
	args?: ArgsValidator;
	handler: (ctx: TracedMutationCtx, args: ObjectType<ArgsValidator>) => Output | Promise<Output>;
}) {
	return mutation({
		args: { ...((fn.args ?? {}) as ArgsValidator), ...traceIdArg },
		handler: async (ctx, args) => {
			const { traceId, ...rest } = args as ObjectType<ArgsValidator> & { traceId?: string };
			const id = resolveTraceId(traceId);
			const tracedCtx = {
				...ctx,
				traceId: id,
				trace: makeTracer(id),
			} as unknown as TracedMutationCtx;
			return withSpans(tracedCtx.trace, true, () =>
				fn.handler(tracedCtx, rest as ObjectType<ArgsValidator>),
			);
		},
	});
}

/** Defines an internal mutation with end-to-end tracing. */
export function tracedInternalMutation<
	ArgsValidator extends PropertyValidators = Record<string, never>,
	Output = unknown,
>(fn: {
	args?: ArgsValidator;
	handler: (ctx: TracedMutationCtx, args: ObjectType<ArgsValidator>) => Output | Promise<Output>;
}) {
	return internalMutation({
		args: { ...((fn.args ?? {}) as ArgsValidator), ...traceIdArg },
		handler: async (ctx, args) => {
			const { traceId, ...rest } = args as ObjectType<ArgsValidator> & { traceId?: string };
			const id = resolveTraceId(traceId);
			const tracedCtx = {
				...ctx,
				traceId: id,
				trace: makeTracer(id),
			} as unknown as TracedMutationCtx;
			return withSpans(tracedCtx.trace, true, () =>
				fn.handler(tracedCtx, rest as ObjectType<ArgsValidator>),
			);
		},
	});
}

/** Defines a public action with end-to-end tracing. */
export function tracedAction<
	ArgsValidator extends PropertyValidators = Record<string, never>,
	Output = unknown,
>(fn: {
	args?: ArgsValidator;
	handler: (ctx: TracedActionCtx, args: ObjectType<ArgsValidator>) => Output | Promise<Output>;
}) {
	return action({
		args: { ...((fn.args ?? {}) as ArgsValidator), ...traceIdArg },
		handler: async (ctx, args) => {
			const { traceId, ...rest } = args as ObjectType<ArgsValidator> & { traceId?: string };
			const id = resolveTraceId(traceId);
			const tracedCtx = {
				...ctx,
				traceId: id,
				trace: makeTracer(id),
			} as unknown as TracedActionCtx;
			return withSpans(tracedCtx.trace, true, () =>
				fn.handler(tracedCtx, rest as ObjectType<ArgsValidator>),
			);
		},
	});
}

/** Defines an internal action with end-to-end tracing. */
export function tracedInternalAction<
	ArgsValidator extends PropertyValidators = Record<string, never>,
	Output = unknown,
>(fn: {
	args?: ArgsValidator;
	handler: (ctx: TracedActionCtx, args: ObjectType<ArgsValidator>) => Output | Promise<Output>;
}) {
	return internalAction({
		args: { ...((fn.args ?? {}) as ArgsValidator), ...traceIdArg },
		handler: async (ctx, args) => {
			const { traceId, ...rest } = args as ObjectType<ArgsValidator> & { traceId?: string };
			const id = resolveTraceId(traceId);
			const tracedCtx = {
				...ctx,
				traceId: id,
				trace: makeTracer(id),
			} as unknown as TracedActionCtx;
			return withSpans(tracedCtx.trace, true, () =>
				fn.handler(tracedCtx, rest as ObjectType<ArgsValidator>),
			);
		},
	});
}
