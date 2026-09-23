import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** The existing feedback page allows organizers and confirmed or late attendees. */
export async function canSubmitEventFeedback(
	ctx: QueryCtx,
	eventId: Id<"events">,
	userId: Id<"users">,
): Promise<boolean> {
	if (!(await ctx.db.get(eventId))) return false;
	const organizer = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId_and_userId", (q) => q.eq("eventId", eventId).eq("userId", userId))
		.first();
	if (organizer) return true;
	const registration = await ctx.db
		.query("registrations")
		.withIndex("by_eventId_and_userId", (q) => q.eq("eventId", eventId).eq("userId", userId))
		.first();
	return (
		registration?.attendanceStatus === "confirmed" || registration?.attendanceStatus === "late"
	);
}
