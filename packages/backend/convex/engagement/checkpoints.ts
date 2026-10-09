import { DAY_MS, eventSemesterOf, eventSemesterRange, HOUR_MS } from "@workspace/shared/time";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { eventsInSemester } from "../events/helper";
import {
	CHECKPOINT_BATCH,
	CHECKPOINT_PRUNE_BATCH,
	CHECKPOINT_RETENTION_MS,
	MAX_CHECKPOINTS_PER_CUTOFF,
	MAX_TOUCHED_ROWS,
	YEAR_DAYS,
} from "./snapshot";
import { computeEventStats, type EventNumbers, isCurrentStats, statsRowOf } from "./stats";

export type SemesterKey = ReturnType<typeof eventSemesterOf>;

function hourStart(at: number) {
	return Math.floor(at / HOUR_MS) * HOUR_MS;
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
		previousCheckpoint: previousAt(hourStart(now)),
		lastYearSemester: eventSemesterOf(lastYear),
		lastYear,
		lastYearCheckpoint: hourStart(lastYear),
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

async function checkpointOf(
	ctx: QueryCtx,
	event: Doc<"events">,
	cutoff: number,
	preloaded?: Doc<"eventCheckpoints">,
) {
	const checkpoint =
		preloaded ??
		(await ctx.db
			.query("eventCheckpoints")
			.withIndex("by_eventId_and_cutoff", (q) => q.eq("eventId", event._id).eq("cutoff", cutoff))
			.first());
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

async function touchedBetween(ctx: QueryCtx, from: number, to: number) {
	const logged = await ctx.db
		.query("registrationLog")
		.withIndex("by_at", (q) => q.gt("at", from).lte("at", to))
		.take(MAX_TOUCHED_ROWS + 1);
	const registered = await ctx.db
		.query("registrations")
		.withIndex("by_registrationTime", (q) =>
			q.gt("registrationTime", from).lte("registrationTime", to),
		)
		.take(MAX_TOUCHED_ROWS + 1);
	if (logged.length > MAX_TOUCHED_ROWS || registered.length > MAX_TOUCHED_ROWS) return null;
	return new Set([...logged, ...registered].map((row) => row.eventId));
}

export type BaselineRows = Awaited<ReturnType<typeof baselineRowsAt>>;

export async function baselineRowsAt(ctx: QueryCtx, cutoff: number, checkpointCutoff: number) {
	const checkpoints = await ctx.db
		.query("eventCheckpoints")
		.withIndex("by_cutoff", (q) => q.eq("cutoff", checkpointCutoff))
		.take(MAX_CHECKPOINTS_PER_CUTOFF);
	return {
		checkpoints: new Map(checkpoints.map((checkpoint) => [checkpoint.eventId, checkpoint])),
		touched: await touchedBetween(ctx, checkpointCutoff, cutoff),
	};
}

export async function baselineStatsAt(
	ctx: QueryCtx,
	event: Doc<"events">,
	cutoff: number,
	checkpointCutoff: number,
	preloaded: (BaselineRows & { stored: Doc<"eventStats"> | null }) | null = null,
) {
	const stored = preloaded ? preloaded.stored : await statsRowOf(ctx, event._id);
	if (stored && isCurrentStats(stored, event, cutoff)) return stored;
	const checkpoint = await checkpointOf(
		ctx,
		event,
		checkpointCutoff,
		preloaded?.checkpoints.get(event._id),
	);
	if (checkpoint) {
		const untouched = preloaded?.touched
			? !preloaded.touched.has(event._id)
			: await untouchedBetween(ctx, event._id, checkpointCutoff, cutoff);
		if (untouched) return checkpoint;
	}
	return await computeEventStats(ctx, event, cutoff);
}

export async function dropCheckpoints(ctx: MutationCtx, eventId: Id<"events">) {
	const rows = await ctx.db
		.query("eventCheckpoints")
		.withIndex("by_eventId_and_cutoff", (q) => q.eq("eventId", eventId))
		.take(CHECKPOINT_PRUNE_BATCH);
	for (const row of rows) await ctx.db.delete(row._id);
}

async function missingCheckpoints(ctx: QueryCtx, key: SemesterKey, cutoff: number) {
	const events = await semesterEventDocs(ctx, key, cutoff + HOUR_MS);
	const missing = await Promise.all(
		events.map(async (event) => {
			const stored = await statsRowOf(ctx, event._id);
			if (stored && isCurrentStats(stored, event, cutoff)) return null;
			if (await checkpointOf(ctx, event, cutoff)) return null;
			return { event, cutoff };
		}),
	);
	return missing.filter((target) => target !== null);
}

async function buildCheckpoint(ctx: MutationCtx, event: Doc<"events">, cutoff: number) {
	try {
		await ctx.db.insert("eventCheckpoints", {
			...(await computeEventStats(ctx, event, cutoff)),
			cutoff,
		});
	} catch (error) {
		if (!(error instanceof ConvexError)) throw error;
	}
}

export const buildCheckpoints = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const cutoffs = [now, now + HOUR_MS].flatMap((hour) => {
			const { previous, previousCheckpoint, lastYearSemester, lastYearCheckpoint } =
				baselineCutoffs(hour);
			return [
				{ key: previous, cutoff: previousCheckpoint },
				{ key: lastYearSemester, cutoff: lastYearCheckpoint },
			];
		});
		const missing = await Promise.all(
			cutoffs.map(({ key, cutoff }) => missingCheckpoints(ctx, key, cutoff)),
		);
		const longest = Math.max(0, ...missing.map((list) => list.length));
		const interleaved = Array.from({ length: longest }, (_, index) =>
			missing.flatMap((list) => list.slice(index, index + 1)),
		).flat();
		const targets = new Map(
			interleaved.map((target) => [`${target.event._id}:${target.cutoff}`, target]),
		);
		const batch = [...targets.values()].slice(0, CHECKPOINT_BATCH);
		await Promise.all(batch.map(({ event, cutoff }) => buildCheckpoint(ctx, event, cutoff)));
		const built = batch.length;
		const stale = await ctx.db
			.query("eventCheckpoints")
			.withIndex("by_creation_time", (q) => q.lt("_creationTime", now - CHECKPOINT_RETENTION_MS))
			.take(CHECKPOINT_PRUNE_BATCH);
		await Promise.all(stale.map((checkpoint) => ctx.db.delete(checkpoint._id)));
		return { built, pruned: stale.length };
	},
});
