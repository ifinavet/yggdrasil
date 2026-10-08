import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
	STATS_REPAIR_AHEAD_MS,
	STATS_REPAIR_BATCH,
	STATS_REPAIR_PAST_MS,
	STATS_SWEEP_BATCH,
} from "./snapshot";
import { type RefreshOutcome, refreshEventStats } from "./stats";

type Tally = Record<RefreshOutcome, number>;

function emptyTally(): Tally {
	return { created: 0, patched: 0, unchanged: 0, removed: 0, skipped: 0 };
}

async function refreshAll(ctx: MutationCtx, eventIds: Iterable<Id<"events">>) {
	const tally = emptyTally();
	for (const eventId of eventIds) tally[await refreshEventStats(ctx, eventId)] += 1;
	return tally;
}

export const sweepStats = internalMutation({
	args: {},
	handler: async (ctx) => {
		const state = await ctx.db.query("statsSweep").first();
		const page = await ctx.db
			.query("events")
			.withIndex("by_eventStart")
			.paginate({ numItems: STATS_SWEEP_BATCH, cursor: state?.cursor ?? null });
		const tally = await refreshAll(
			ctx,
			page.page.map(({ _id }) => _id),
		);
		const cursor = page.isDone ? null : page.continueCursor;
		if (state) await ctx.db.patch(state._id, { cursor });
		else await ctx.db.insert("statsSweep", { cursor });
		return { ...tally, finished: page.isDone };
	},
});

export const repairRecentStats = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const events = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) =>
				q
					.gte("eventStart", now - STATS_REPAIR_PAST_MS)
					.lte("eventStart", now + STATS_REPAIR_AHEAD_MS),
			)
			.take(STATS_REPAIR_BATCH);
		return await refreshAll(
			ctx,
			events.map(({ _id }) => _id),
		);
	},
});
