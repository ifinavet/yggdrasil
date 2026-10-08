import { DAY_MS, eventSemesterOf, eventSemesterRange } from "@workspace/shared/time";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
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

function dayStart(at: number) {
	return Math.floor(at / DAY_MS) * DAY_MS;
}

export function baselineCutoffs(now: number) {
	const current = eventSemesterOf(now);
	const currentStart = eventSemesterRange(current.semester, current.year).start;
	const previous = eventSemesterOf(currentStart - DAY_MS);
	const previousRange = eventSemesterRange(previous.semester, previous.year);
	const previousAt = (at: number) =>
		Math.min(
			previousRange.start + Math.max(at, currentStart) - currentStart,
			previousRange.end - 1,
		);
	const lastYear = now - YEAR_DAYS * DAY_MS;
	return {
		previous,
		previousCutoff: previousAt(now),
		previousCheckpoint: previousAt(dayStart(now)),
		lastYearSemester: eventSemesterOf(lastYear),
		lastYear,
		lastYearCheckpoint: dayStart(lastYear),
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

async function untouchedBetween(ctx: QueryCtx, eventId: Id<"events">, from: number, to: number) {
	if (from >= to) return true;
	const logged = await ctx.db
		.query("registrationLog")
		.withIndex("by_eventId_and_at", (q) => q.eq("eventId", eventId).gt("at", from).lte("at", to))
		.first();
	if (logged) return false;
	const registered = await ctx.db
		.query("registrations")
		.withIndex("by_eventIdAndRegistrationTime", (q) =>
			q.eq("eventId", eventId).gt("registrationTime", from).lte("registrationTime", to),
		)
		.first();
	return !registered;
}

export async function baselineStatsAt(
	ctx: QueryCtx,
	event: Doc<"events">,
	cutoff: number,
	checkpointCutoff: number,
) {
	const stored = await statsRowOf(ctx, event._id);
	if (stored && isCurrentStats(stored, event, cutoff)) return stored;
	const checkpoint = await checkpointOf(ctx, event, checkpointCutoff);
	if (checkpoint && (await untouchedBetween(ctx, event._id, checkpointCutoff, cutoff))) {
		return checkpoint;
	}
	return await eventStatsAt(ctx, event, cutoff);
}

export async function dropCheckpoints(ctx: MutationCtx, eventId: Id<"events">) {
	const rows = await ctx.db
		.query("eventCheckpoints")
		.withIndex("by_eventId_and_cutoff", (q) => q.eq("eventId", eventId))
		.take(CHECKPOINT_PRUNE_BATCH);
	for (const row of rows) await ctx.db.delete(row._id);
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
		const { previous, previousCheckpoint, lastYearSemester, lastYearCheckpoint } =
			baselineCutoffs(now);
		let built = await buildFor(ctx, previous, previousCheckpoint, CHECKPOINT_BATCH);
		built += await buildFor(ctx, lastYearSemester, lastYearCheckpoint, CHECKPOINT_BATCH - built);
		const stale = await ctx.db
			.query("eventCheckpoints")
			.withIndex("by_creation_time", (q) => q.lt("_creationTime", now - CHECKPOINT_RETENTION_MS))
			.take(CHECKPOINT_PRUNE_BATCH);
		for (const checkpoint of stale) await ctx.db.delete(checkpoint._id);
		return { built, pruned: stale.length };
	},
});
