import { DAY_MS, eventSemesterOf, eventSemesterRange } from "@workspace/shared/time";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { eventsInSemester } from "../events/helper";
import {
	CHECKPOINT_BATCH,
	CHECKPOINT_PRUNE_BATCH,
	CHECKPOINT_RETENTION_MS,
	YEAR_DAYS,
} from "./snapshot";
import {
	computeEventStats,
	type EventNumbers,
	eventStatsAt,
	isCurrentStats,
	statsRowOf,
} from "./stats";

export type SemesterKey = ReturnType<typeof eventSemesterOf>;

export function baselineCutoffs(now: number) {
	const today = Math.floor(now / DAY_MS) * DAY_MS;
	const current = eventSemesterOf(now);
	const currentStart = eventSemesterRange(current.semester, current.year).start;
	const previous = eventSemesterOf(currentStart - DAY_MS);
	const previousRange = eventSemesterRange(previous.semester, previous.year);
	const lastYear = today - YEAR_DAYS * DAY_MS;
	return {
		previous,
		previousCutoff: Math.min(
			previousRange.start + Math.max(today, currentStart) - currentStart,
			previousRange.end - 1,
		),
		lastYearSemester: eventSemesterOf(lastYear),
		lastYear,
	};
}

export async function semesterEventDocs(ctx: QueryCtx, key: SemesterKey, cutoff: number) {
	return (await eventsInSemester(ctx, key.semester, key.year)).filter(
		(event) =>
			event.published &&
			!event.externalEvent &&
			event.participationLimit > 0 &&
			event.registrationOpens <= cutoff,
	);
}

async function checkpointOf(ctx: QueryCtx, event: Doc<"events">, cutoff: number) {
	const checkpoint = await ctx.db
		.query("eventCheckpoints")
		.withIndex("by_eventId_and_cutoff", (q) => q.eq("eventId", event._id).eq("cutoff", cutoff))
		.first();
	if (
		!checkpoint ||
		checkpoint.eventStart !== event.eventStart ||
		checkpoint.participationLimit !== event.participationLimit
	) {
		return null;
	}
	const { _id, _creationTime, cutoff: _cutoff, ...numbers } = checkpoint;
	return numbers satisfies EventNumbers;
}

export async function baselineStatsAt(ctx: QueryCtx, event: Doc<"events">, cutoff: number) {
	const stored = await statsRowOf(ctx, event._id);
	if (stored && isCurrentStats(stored, event, cutoff)) return stored;
	return (await checkpointOf(ctx, event, cutoff)) ?? (await eventStatsAt(ctx, event, cutoff));
}

async function buildFor(ctx: MutationCtx, key: SemesterKey, cutoff: number, budget: number) {
	let built = 0;
	for (const event of await semesterEventDocs(ctx, key, cutoff)) {
		if (built >= budget) break;
		const stored = await statsRowOf(ctx, event._id);
		if (stored && isCurrentStats(stored, event, cutoff)) continue;
		if (await checkpointOf(ctx, event, cutoff)) continue;
		try {
			await ctx.db.insert("eventCheckpoints", {
				...(await computeEventStats(ctx, event, cutoff)),
				cutoff,
			});
		} catch (error) {
			if (!(error instanceof ConvexError)) throw error;
		}
		built += 1;
	}
	return built;
}

export const buildCheckpoints = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const { previous, previousCutoff, lastYearSemester, lastYear } = baselineCutoffs(now);
		let built = await buildFor(ctx, previous, previousCutoff, CHECKPOINT_BATCH);
		built += await buildFor(ctx, lastYearSemester, lastYear, CHECKPOINT_BATCH - built);
		const stale = await ctx.db
			.query("eventCheckpoints")
			.withIndex("by_creation_time", (q) => q.lt("_creationTime", now - CHECKPOINT_RETENTION_MS))
			.take(CHECKPOINT_PRUNE_BATCH);
		for (const checkpoint of stale) await ctx.db.delete(checkpoint._id);
		return { built, pruned: stale.length };
	},
});
