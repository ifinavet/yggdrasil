import { DAY_MS } from "@workspace/shared/time";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { firstFilledAt, registrationHistory, registrationsAt } from "./history";

export type EventNumbers = Omit<Doc<"eventStats">, "_id" | "_creationTime">;

export async function computeEventStats(
	ctx: QueryCtx,
	event: Doc<"events">,
): Promise<EventNumbers> {
	const history = await registrationHistory(ctx, event._id);
	const rows = registrationsAt(history, Number.POSITIVE_INFINITY);
	const registered = rows.filter((row) => row.status === "registered");
	const recorded = registered.some((row) => row.attendanceStatus);
	const windowStart = event.eventStart - DAY_MS;
	return {
		eventId: event._id,
		eventStart: event.eventStart,
		participationLimit: event.participationLimit,
		changedAt: history.entries.at(-1)?.at ?? 0,
		registered: registered.length,
		waitlist: rows.filter((row) => row.status === "waitlist").length,
		pending: rows.filter((row) => row.status === "pending").length,
		attendanceRecorded: recorded,
		showedUp: registered.filter(
			({ attendanceStatus }) => attendanceStatus === "confirmed" || attendanceStatus === "late",
		).length,
		noShows: registered.filter(({ attendanceStatus }) => attendanceStatus === "no_show").length,
		filledAt: firstFilledAt(history.entries, event.participationLimit),
		lateUnregistrations: history.entries.filter(
			(entry) =>
				entry.change === "unregistered" &&
				entry.fromStatus === "registered" &&
				entry.at > windowStart &&
				entry.at <= event.eventStart,
		).length,
		registrants: registered.map((row) => row.userId),
	};
}

export function isCurrentStats(
	stats: Doc<"eventStats">,
	event: Doc<"events">,
	now: number,
): boolean {
	return (
		stats.eventStart === event.eventStart &&
		stats.participationLimit === event.participationLimit &&
		stats.changedAt <= now
	);
}

export async function statsRowOf(ctx: QueryCtx, eventId: Id<"events">) {
	return await ctx.db
		.query("eventStats")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.first();
}

export async function eventStatsAt(
	ctx: QueryCtx,
	event: Doc<"events">,
	now: number,
): Promise<EventNumbers> {
	const stored = await statsRowOf(ctx, event._id);
	if (stored && isCurrentStats(stored, event, now)) return stored;
	return await computeEventStats(ctx, event);
}

export type RefreshOutcome = "created" | "patched" | "unchanged" | "removed" | "skipped";

function sameNumbers(stored: Doc<"eventStats">, computed: EventNumbers) {
	return (Object.keys(computed) as (keyof EventNumbers)[]).every((key) => {
		const next = computed[key];
		const current = stored[key];
		return Array.isArray(next) ? next.join() === (current as typeof next).join() : next === current;
	});
}

export async function refreshEventStats(
	ctx: MutationCtx,
	eventId: Id<"events">,
): Promise<RefreshOutcome> {
	const stored = await statsRowOf(ctx, eventId);
	const event = await ctx.db.get(eventId);
	if (!event) {
		if (!stored) return "unchanged";
		await ctx.db.delete(stored._id);
		return "removed";
	}
	let computed: EventNumbers;
	try {
		computed = await computeEventStats(ctx, event);
	} catch (error) {
		if (error instanceof ConvexError) return "skipped";
		throw error;
	}
	if (!stored) {
		await ctx.db.insert("eventStats", computed);
		return "created";
	}
	if (sameNumbers(stored, computed)) return "unchanged";
	await ctx.db.replace(stored._id, computed);
	return "patched";
}
