import { DAY_MS } from "@workspace/shared/time";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { REMINDER_KINDS } from "../events/reminders/schedule";
import { firstFilledAt, registrationHistory } from "./history";
import {
	alignedCurve,
	BASELINE_SIZE,
	COMPANY_BASELINE,
	classify,
	type ForecastTimeline,
	isSimilarCapacity,
	medianCurve,
	progressOf,
	projectFill,
	recentUnregistrations,
	seatCurve,
	seatDelta,
	valueAt,
} from "./metrics";

export const MAX_REGISTRATIONS_PER_EVENT = 1000;
const MAX_LOG_ENTRIES = 1000;
const PAST_EVENTS_FOR_BASELINE = 60;
export const UNREGISTRATION_HISTORY_START = Date.UTC(2025, 7, 10);

export type PastCurve = {
	eventId: Id<"events">;
	limit: number;
	curve: number[];
	timeline?: ForecastTimeline;
};
export const MIN_FORECAST_EVENTS = 3;

async function forecastTimeline(ctx: QueryCtx, event: Doc<"events">): Promise<ForecastTimeline> {
	const reminders = await Promise.all(
		REMINDER_KINDS.map((kind) =>
			ctx.db
				.query("eventReminders")
				.withIndex("by_eventId_and_kind", (q) => q.eq("eventId", event._id).eq("kind", kind))
				.unique(),
		),
	);
	return {
		registrationOpens: event.registrationOpens,
		eventStart: event.eventStart,
		remindersEnabled: event.remindersEnabled,
		reminderTimes: Object.fromEntries(reminders.flatMap((r) => (r ? [[r.kind, r.queuedAt]] : []))),
	};
}

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

function isComparable(event: Doc<"events">) {
	return event.published && !event.externalEvent && event.participationLimit > 0;
}

function hasComparableHistory(event: Doc<"events">) {
	return isComparable(event) && event.registrationOpens >= UNREGISTRATION_HISTORY_START;
}

async function curvesOf(ctx: QueryCtx, events: readonly Doc<"events">[]): Promise<PastCurve[]> {
	const curves = await Promise.all(
		events.map(async (event) => {
			const log = await ctx.db
				.query("registrationLog")
				.withIndex("by_eventId_and_at", (q) =>
					q.eq("eventId", event._id).lte("at", event.eventStart),
				)
				.take(MAX_LOG_ENTRIES + 1);
			if (log.length === 0 || log.length > MAX_LOG_ENTRIES) return null;
			return {
				eventId: event._id,
				limit: event.participationLimit,
				curve: seatCurve(event, event.participationLimit, log),
				timeline: await forecastTimeline(ctx, event),
			};
		}),
	);
	return curves.filter((curve) => curve !== null);
}

export async function pastCurvesBefore(ctx: QueryCtx, before: number) {
	const past = await ctx.db
		.query("events")
		.withIndex("by_eventStart", (q) => q.lt("eventStart", before))
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
	for await (const event of ctx.db
		.query("events")
		.withIndex("by_hostingCompany_and_eventStart", (q) =>
			q.eq("hostingCompany", companyId).lt("eventStart", before),
		)
		.order("desc")) {
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
	const aligned = (past: PastCurve) =>
		timeline && past.timeline ? alignedCurve(past.curve, past.timeline, timeline) : past.curve;
	const own = companyCurves.filter(comparable).slice(0, COMPANY_BASELINE.size);
	const ownIds = new Set(own.map((past) => past.eventId));
	const pool = pastCurves
		.filter(
			(past) =>
				comparable(past) && !ownIds.has(past.eventId) && isSimilarCapacity(limit, past.limit),
		)
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

export async function snapshotOf(
	ctx: QueryCtx,
	event: Doc<"events">,
	now: number,
	pastCurves: readonly PastCurve[],
) {
	const registrationTimes = await registrationTimesOf(ctx, event._id);
	const history = await registrationHistory(ctx, event._id);
	const filledAt = firstFilledAt(
		history.entries.filter(({ at }) => at <= now),
		event.participationLimit,
	);
	const recentLog = await logSince(ctx, event._id, now - DAY_MS);
	const unregistrations = recentUnregistrations(recentLog, now);
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
	const registered = registrationTimes.length;
	const currentFill = registered / event.participationLimit;

	return {
		registered,
		registrationTimes,
		unregistrations,
		delta24h: seatDelta(recentLog),
		progress,
		baseline,
		expectedFillNow: baseline ? valueAt(baseline.curve, progress) : null,
		projectedFill: projectFill(currentFill, progress, baseline?.curve ?? null),
		status: classify({
			now,
			timeline: event,
			limit: event.participationLimit,
			registrationTimes,
			filledAt,
			unregistrations: unregistrations.length,
			baseline: baseline?.curve ?? null,
		}),
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
