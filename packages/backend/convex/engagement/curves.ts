import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { REMINDER_KINDS } from "../events/reminders/schedule";
import { demandCurve, type ForecastTimeline } from "./metrics";

export const UNREGISTRATION_HISTORY_START = Date.UTC(2025, 7, 10);
export const MAX_LOG_ENTRIES = 1000;
export const CURVE_BACKFILL_BATCH = 20;

export type PastCurve = {
	eventId: Id<"events">;
	limit: number;
	curve: number[];
	timeline?: ForecastTimeline;
};

type CurveRow = Omit<Doc<"eventCurves">, "_id" | "_creationTime">;

export function isComparable(event: Doc<"events">) {
	return event.published && !event.externalEvent && event.participationLimit > 0;
}

export function hasComparableHistory(event: Doc<"events">) {
	return isComparable(event) && event.registrationOpens >= UNREGISTRATION_HISTORY_START;
}

export async function forecastTimeline(
	ctx: QueryCtx,
	event: Doc<"events">,
): Promise<ForecastTimeline> {
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

async function computeCurve(ctx: QueryCtx, event: Doc<"events">): Promise<CurveRow> {
	const log = await ctx.db
		.query("registrationLog")
		.withIndex("by_eventId_and_at", (q) => q.eq("eventId", event._id).lte("at", event.eventStart))
		.take(MAX_LOG_ENTRIES + 1);
	const timeline = await forecastTimeline(ctx, event);
	const usable = log.length > 0 && log.length <= MAX_LOG_ENTRIES;
	return {
		eventId: event._id,
		eventStart: event.eventStart,
		registrationOpens: event.registrationOpens,
		participationLimit: event.participationLimit,
		remindersEnabled: event.remindersEnabled,
		reminderTimes: timeline.reminderTimes ?? {},
		curve: usable ? demandCurve(event, event.participationLimit, log) : null,
	};
}

type CurveInputs = Pick<
	Doc<"events">,
	"eventStart" | "registrationOpens" | "participationLimit" | "remindersEnabled"
>;

function matchesEvent(row: CurveInputs, event: CurveInputs) {
	return (
		row.eventStart === event.eventStart &&
		row.registrationOpens === event.registrationOpens &&
		row.participationLimit === event.participationLimit &&
		row.remindersEnabled === event.remindersEnabled
	);
}

function pastCurveFrom(row: CurveRow): PastCurve | null {
	if (!row.curve) return null;
	return {
		eventId: row.eventId,
		limit: row.participationLimit,
		curve: row.curve,
		timeline: {
			registrationOpens: row.registrationOpens,
			eventStart: row.eventStart,
			remindersEnabled: row.remindersEnabled,
			reminderTimes: row.reminderTimes,
		},
	};
}

async function curveRowOf(ctx: QueryCtx, eventId: Id<"events">) {
	return await ctx.db
		.query("eventCurves")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.unique();
}

export async function curveOf(ctx: QueryCtx, event: Doc<"events">) {
	const stored = await curveRowOf(ctx, event._id);
	if (stored && matchesEvent(stored, event)) return pastCurveFrom(stored);
	return pastCurveFrom(await computeCurve(ctx, event));
}

function sameCurve(stored: CurveRow, computed: CurveRow) {
	return (
		matchesEvent(stored, computed) &&
		JSON.stringify(stored.reminderTimes) === JSON.stringify(computed.reminderTimes) &&
		stored.curve?.join() === computed.curve?.join()
	);
}

export async function refreshEventCurve(ctx: MutationCtx, event: Doc<"events">, now: number) {
	const stored = await curveRowOf(ctx, event._id);
	if (!hasComparableHistory(event) || event.eventStart > now) {
		if (stored) await ctx.db.delete(stored._id);
		return;
	}
	const computed = await computeCurve(ctx, event);
	if (!stored) await ctx.db.insert("eventCurves", computed);
	else if (!sameCurve(stored, computed)) await ctx.db.replace(stored._id, computed);
}

export async function dropEventCurve(ctx: MutationCtx, eventId: Id<"events">) {
	const stored = await curveRowOf(ctx, eventId);
	if (stored) await ctx.db.delete(stored._id);
}

export const backfillCurves = internalMutation({
	args: { cursor: v.optional(v.string()), until: v.optional(v.number()) },
	handler: async (ctx, { cursor, until }) => {
		const state = await ctx.db.query("curveBackfill").first();
		if (cursor === undefined && state?.done) return { finished: true };
		const end = until ?? Date.now();
		const page = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) =>
				q.gte("eventStart", UNREGISTRATION_HISTORY_START).lte("eventStart", end),
			)
			.paginate({ numItems: CURVE_BACKFILL_BATCH, cursor: cursor ?? null });
		for (const event of page.page) await refreshEventCurve(ctx, event, Date.now());
		if (!page.isDone) {
			await ctx.scheduler.runAfter(0, internal.engagement.curves.backfillCurves, {
				cursor: page.continueCursor,
				until: end,
			});
			return { finished: false };
		}
		if (state) await ctx.db.patch(state._id, { done: true });
		else await ctx.db.insert("curveBackfill", { done: true });
		return { finished: true };
	},
});
