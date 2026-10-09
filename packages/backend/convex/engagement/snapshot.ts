import { DAY_MS } from "@workspace/shared/time";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
	curvesOf,
	forecastTimeline,
	hasComparableHistory,
	isComparable,
	MAX_LOG_ENTRIES,
	type PastCurve,
	UNREGISTRATION_HISTORY_START,
} from "./curves";
import {
	alignedCurve,
	BASELINE_SIZE,
	COMPANY_BASELINE,
	classify,
	type ForecastTimeline,
	medianCurve,
	progressOf,
	projectFill,
	recentUnregistrations,
	seatDelta,
} from "./metrics";
import { eventStatsAt } from "./stats";

export { DAY_MS as CHECKPOINT_RETENTION_MS } from "@workspace/shared/time";

export const MAX_REGISTRATIONS_PER_EVENT = 1000;
const PAST_EVENTS_FOR_BASELINE = 60;
export const MIN_FORECAST_EVENTS = 3;
// Each history reads up to 4,001 registrations and 4,001 log entries.
// Three events leave room below the 32,000-document transaction ceiling.
export const STATS_SWEEP_BATCH = 3;
export const YEAR_DAYS = 365;
export const CHECKPOINT_BATCH = 3;
export const CHECKPOINT_PRUNE_BATCH = 200;
export const MAX_CHECKPOINTS_PER_CUTOFF = 2000;
export const MAX_TOUCHED_ROWS = 1000;
export const STATS_REPAIR_BATCH = STATS_SWEEP_BATCH;
export const STATS_REPAIR_PAST_MS = DAY_MS;
export const STATS_REPAIR_AHEAD_MS = 14 * DAY_MS;

export async function registrationTimesOf(ctx: QueryCtx, eventId: Id<"events">) {
	const registered = await ctx.db
		.query("registrations")
		.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
			q.eq("eventId", eventId).eq("status", "registered"),
		)
		.take(MAX_REGISTRATIONS_PER_EVENT);
	return registered.map((registration) => registration.registrationTime);
}

export async function waitlistCountOf(ctx: QueryCtx, eventId: Id<"events">) {
	const waiting = await ctx.db
		.query("registrations")
		.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
			q.eq("eventId", eventId).eq("status", "waitlist"),
		)
		.take(MAX_REGISTRATIONS_PER_EVENT);
	return waiting.length;
}

export async function logSince(ctx: QueryCtx, eventId: Id<"events">, since: number) {
	return await ctx.db
		.query("registrationLog")
		.withIndex("by_eventId_and_at", (q) => q.eq("eventId", eventId).gt("at", since))
		.take(MAX_LOG_ENTRIES);
}

export async function pastCurvesBefore(ctx: QueryCtx, before: number) {
	const past = await ctx.db
		.query("events")
		.withIndex("by_eventStart", (q) =>
			q.gte("eventStart", UNREGISTRATION_HISTORY_START).lt("eventStart", before),
		)
		.order("desc")
		.take(PAST_EVENTS_FOR_BASELINE);
	return await curvesOf(ctx, past.filter(hasComparableHistory));
}

export async function companyCurvesBefore(
	ctx: QueryCtx,
	companyId: Id<"companies">,
	before: number,
) {
	const comparable: Doc<"events">[] = [];
	for (const event of await ctx.db
		.query("events")
		.withIndex("by_hostingCompany_and_eventStart", (q) =>
			q
				.eq("hostingCompany", companyId)
				.gte("eventStart", UNREGISTRATION_HISTORY_START)
				.lt("eventStart", before),
		)
		.order("desc")
		.take(PAST_EVENTS_FOR_BASELINE)) {
		if (hasComparableHistory(event)) comparable.push(event);
		if (comparable.length === COMPANY_BASELINE.size) break;
	}
	return await curvesOf(ctx, comparable);
}

export function baselineFor(
	pastCurves: readonly PastCurve[],
	limit: number,
	companyCurves: readonly PastCurve[] = [],
	timeline?: ForecastTimeline,
) {
	const comparable = (past: PastCurve) =>
		// Missing settings on legacy events mean unknown, not explicitly disabled.
		past.timeline?.remindersEnabled === undefined ||
		timeline?.remindersEnabled === undefined ||
		past.timeline.remindersEnabled === timeline.remindersEnabled;
	const aligned = (past: PastCurve) => {
		const curve =
			timeline && past.timeline ? alignedCurve(past.curve, past.timeline, timeline) : past.curve;
		return curve.map((fill) => Math.min(1, fill * (past.limit / limit)));
	};
	const own = companyCurves.filter(comparable).slice(0, COMPANY_BASELINE.size);
	const ownIds = new Set(own.map((past) => past.eventId));
	const pool = pastCurves
		.filter((past) => comparable(past) && !ownIds.has(past.eventId))
		.slice(0, BASELINE_SIZE);
	const poolCurve = medianCurve(pool.map(aligned));
	const ownCurve = medianCurve(own.map(aligned));
	const size = pool.length + own.length;
	// Avoid reversing a company’s established pattern with unrelated companies.
	if (ownCurve && own.length >= MIN_FORECAST_EVENTS) return { curve: ownCurve, size: own.length };
	if (!ownCurve) return poolCurve && { curve: poolCurve, size };
	if (!poolCurve) return { curve: ownCurve, size };
	const weight = own.length / (own.length + COMPANY_BASELINE.poolWeight);
	const curve = ownCurve.map(
		(value, step) => weight * value + (1 - weight) * (poolCurve[step] as number),
	);
	return { curve, size };
}

export async function liveStateOf(ctx: QueryCtx, event: Doc<"events">, now: number) {
	const stats = await eventStatsAt(ctx, event, Number.POSITIVE_INFINITY);
	const recentLog = await logSince(ctx, event._id, now - DAY_MS);
	const unregistrations = recentUnregistrations(recentLog, now);
	return {
		registered: stats.registered,
		waitlist: stats.waitlist,
		unregistrations,
		delta24h: seatDelta(recentLog),
		status: classify({
			now,
			timeline: event,
			limit: event.participationLimit,
			registered: stats.registered,
			filledAt: stats.filledAt,
			unregistrations: unregistrations.length,
		}),
	};
}

export async function snapshotOf(
	ctx: QueryCtx,
	event: Doc<"events">,
	now: number,
	pastCurves: readonly PastCurve[],
) {
	const live = await liveStateOf(ctx, event, now);
	const companyCurves = await companyCurvesBefore(
		ctx,
		event.hostingCompany,
		Math.min(now, event.eventStart),
	);
	const baseline = baselineFor(
		pastCurves,
		event.participationLimit,
		companyCurves,
		await forecastTimeline(ctx, event),
	);
	const progress = progressOf(event, now);
	const demandFill = (live.registered + live.waitlist) / event.participationLimit;

	return {
		...live,
		demandFill,
		progress,
		baseline,
		projectedFill: projectFill(demandFill, progress, baseline?.curve ?? null),
	};
}

export async function upcomingEvents(ctx: QueryCtx, now: number, limit: number) {
	const eligible: Doc<"events">[] = [];
	for await (const event of ctx.db
		.query("events")
		.withIndex("by_eventStart", (q) => q.gte("eventStart", now))) {
		if (isComparable(event)) eligible.push(event);
		if (eligible.length === limit) break;
	}
	return eligible;
}
