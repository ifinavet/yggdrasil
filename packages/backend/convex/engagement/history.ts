import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { type LogEntry, seatDelta } from "./metrics";

export type AnalyticsRegistration = Pick<
	Doc<"registrations">,
	"userId" | "status" | "registrationTime" | "attendanceStatus"
>;

const changeOfStatus = {
	registered: "registered",
	pending: "offered",
	waitlist: "waitlisted",
} satisfies Record<AnalyticsRegistration["status"], LogEntry["change"]>;

const statusOfChange: Partial<Record<LogEntry["change"], AnalyticsRegistration["status"]>> = {
	registered: "registered",
	accepted: "registered",
	waitlisted: "waitlist",
	offered: "pending",
	expired: "waitlist",
};

const HISTORY_LIMIT = 4000;

// Logs preserve cancellations and seat replacements. Unlogged surviving rows are
// the only recoverable history for events predating the registration-log backfill.
export async function registrationHistory(ctx: QueryCtx, eventId: Id<"events">) {
	const registrations = await ctx.db
		.query("registrations")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.take(HISTORY_LIMIT + 1);
	const logged = await ctx.db
		.query("registrationLog")
		.withIndex("by_eventId_and_at", (q) => q.eq("eventId", eventId))
		.take(HISTORY_LIMIT + 1);
	if (registrations.length > HISTORY_LIMIT || logged.length > HISTORY_LIMIT) {
		throw new ConvexError("Påmeldingshistorikken er for stor til å beregne innsikt fullstendig.");
	}
	const loggedUsers = new Set(logged.map((entry) => entry.userId));
	const entries: (LogEntry & { userId: Id<"users"> })[] = [
		...logged,
		...registrations
			.filter((row) => !loggedUsers.has(row.userId))
			.map((row) => ({
				userId: row.userId,
				at: row.registrationTime,
				change: changeOfStatus[row.status],
			})),
	].sort((a, b) => a.at - b.at);
	return { entries, registrations };
}

export function registrationsAt(
	history: Awaited<ReturnType<typeof registrationHistory>>,
	cutoff: number,
): AnalyticsRegistration[] {
	const current = new Map(history.registrations.map((row) => [row.userId, row]));
	const rows = new Map<Id<"users">, AnalyticsRegistration>();
	for (const entry of history.entries) {
		if (entry.at > cutoff) break;
		const status = statusOfChange[entry.change];
		if (status === undefined) {
			rows.delete(entry.userId);
		} else {
			rows.set(entry.userId, {
				userId: entry.userId,
				status,
				registrationTime: entry.at,
				attendanceStatus: current.get(entry.userId)?.attendanceStatus,
			});
		}
	}
	return [...rows.values()];
}

export function firstFilledAt(entries: readonly LogEntry[], limit: number) {
	if (limit <= 0) return null;
	let seats = 0;
	for (const entry of entries) {
		seats += seatDelta([entry]);
		if (seats >= limit) return entry.at;
	}
	return null;
}
