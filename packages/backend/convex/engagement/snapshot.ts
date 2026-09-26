import { DAY_MS } from "@workspace/shared/time";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
	BASELINE_SIZE,
	classify,
	fillCurve,
	isSimilarCapacity,
	medianCurve,
	progressOf,
	projectFill,
	recentUnregistrations,
	seatDelta,
	valueAt,
} from "./metrics";

export const MAX_REGISTRATIONS_PER_EVENT = 1000;
const MAX_LOG_ENTRIES = 1000;
const PAST_EVENTS_FOR_BASELINE = 60;

export type PastCurve = { limit: number; curve: number[] };

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

export async function pastCurvesBefore(ctx: QueryCtx, before: number): Promise<PastCurve[]> {
	const past = await ctx.db
		.query("events")
		.withIndex("by_eventStart", (q) => q.lt("eventStart", before))
		.order("desc")
		.take(PAST_EVENTS_FOR_BASELINE);
	const comparable = past.filter(
		(event) => event.published && !event.externalEvent && event.participationLimit > 0,
	);
	return await Promise.all(
		comparable.map(async (event) => ({
			limit: event.participationLimit,
			curve: fillCurve(event, event.participationLimit, await registrationTimesOf(ctx, event._id)),
		})),
	);
}

export function baselineFor(pastCurves: readonly PastCurve[], limit: number) {
	const similar = pastCurves
		.filter((past) => isSimilarCapacity(limit, past.limit))
		.slice(0, BASELINE_SIZE);
	const curve = medianCurve(similar.map((past) => past.curve));
	return curve ? { curve, size: similar.length } : null;
}

export async function snapshotOf(
	ctx: QueryCtx,
	event: Doc<"events">,
	now: number,
	pastCurves: readonly PastCurve[],
) {
	const registrationTimes = await registrationTimesOf(ctx, event._id);
	const recentLog = await logSince(ctx, event._id, now - DAY_MS);
	const unregistrations = recentUnregistrations(recentLog, now);
	const baseline = baselineFor(pastCurves, event.participationLimit);
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
		if (event.published && !event.externalEvent && event.participationLimit > 0) {
			eligible.push(event);
		}
		if (eligible.length === limit) break;
	}
	return eligible;
}
