import { DAY_MS } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { EventCounts } from "./companyMetrics";
import { queueCurveRefresh } from "./curves";
import { firstFilledAt, registrationHistory, registrationsAt } from "./history";

export type EventNumbers = Omit<Doc<"eventStats">, "_id" | "_creationTime">;

export async function computeEventStats(
	ctx: QueryCtx,
	event: Doc<"events">,
	cutoff = Number.POSITIVE_INFINITY,
): Promise<EventNumbers> {
	const history = await registrationHistory(ctx, event._id);
	const entries = history.entries.filter(({ at }) => at <= cutoff);
	const rows = registrationsAt(history, cutoff);
	const registered = rows.filter((row) => row.status === "registered");
	const recorded = registered.some((row) => row.attendanceStatus);
	const windowStart = event.eventStart - DAY_MS;
	return {
		eventId: event._id,
		eventStart: event.eventStart,
		participationLimit: event.participationLimit,
		changedAt: entries.at(-1)?.at ?? 0,
		registered: registered.length,
		waitlist: rows.filter((row) => row.status === "waitlist").length,
		pending: rows.filter((row) => row.status === "pending").length,
		attendanceRecorded: recorded,
		showedUp: registered.filter(
			({ attendanceStatus }) => attendanceStatus === "confirmed" || attendanceStatus === "late",
		).length,
		noShows: registered.filter(({ attendanceStatus }) => attendanceStatus === "no_show").length,
		filledAt: firstFilledAt(entries, event.participationLimit),
		lateUnregistrations: entries.filter(
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

export async function statsRowsBetween(ctx: QueryCtx, from: number, to: number) {
	const rows = await ctx.db
		.query("eventStats")
		.withIndex("by_eventStart", (q) => q.gte("eventStart", from).lt("eventStart", to))
		.collect();
	return new Map(rows.map((row) => [row.eventId, row]));
}

export async function eventStatsAt(
	ctx: QueryCtx,
	event: Doc<"events">,
	now: number,
	preloaded?: Doc<"eventStats"> | null,
): Promise<EventNumbers> {
	const stored = preloaded === undefined ? await statsRowOf(ctx, event._id) : preloaded;
	if (stored && isCurrentStats(stored, event, now)) return stored;
	return await computeEventStats(ctx, event, now);
}

export function countsOf(stats: EventNumbers): EventCounts {
	return {
		registered: stats.registered,
		waitlist: stats.waitlist,
		total: stats.registered + stats.waitlist + stats.pending,
		recorded: stats.attendanceRecorded,
		showedUp: stats.showedUp,
		noShows: stats.noShows,
	};
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
		if (!(error instanceof ConvexError)) throw error;
		if (!stored) return "skipped";
		await ctx.db.delete(stored._id);
		return "removed";
	}
	await queueCurveRefresh(ctx, event, Date.now());
	if (!stored) {
		await ctx.db.insert("eventStats", computed);
		return "created";
	}
	if (sameNumbers(stored, computed)) return "unchanged";
	await ctx.db.replace(stored._id, computed);
	return "patched";
}

const SHOWED_UP: readonly (Doc<"registrations">["attendanceStatus"] | undefined)[] = [
	"confirmed",
	"late",
];

export async function patchAttendanceStats(
	ctx: MutationCtx,
	registration: Pick<Doc<"registrations">, "eventId" | "userId" | "attendanceStatus">,
	next: NonNullable<Doc<"registrations">["attendanceStatus"]>,
) {
	const stored = await statsRowOf(ctx, registration.eventId);
	if (!stored) return;
	const previous = registration.attendanceStatus;
	const counted = stored.registrants.includes(registration.userId);
	const showedUp = (status: typeof previous) => (SHOWED_UP.includes(status) ? 1 : 0);
	const noShow = (status: typeof previous) => (status === "no_show" ? 1 : 0);
	const patch = {
		attendanceRecorded: stored.attendanceRecorded || counted,
		showedUp: stored.showedUp + (counted ? showedUp(next) - showedUp(previous) : 0),
		noShows: stored.noShows + (counted ? noShow(next) - noShow(previous) : 0),
	};
	if (
		patch.attendanceRecorded === stored.attendanceRecorded &&
		patch.showedUp === stored.showedUp &&
		patch.noShows === stored.noShows
	) {
		return;
	}
	await ctx.db.patch(stored._id, patch);
}

export const refreshStats = internalMutation({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => await refreshEventStats(ctx, eventId),
});
