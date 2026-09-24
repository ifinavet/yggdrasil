import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/**
 * The application an event was created from, which holds the event's logistics.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"events">} eventId - The event.
 *
 * @returns {Promise<Doc<"companyApplications"> | null>} - The application, or null for other events.
 */
export async function findApplicationForEvent(
	ctx: QueryCtx | MutationCtx,
	eventId: Id<"events">,
): Promise<Doc<"companyApplications"> | null> {
	return ctx.db
		.query("companyApplications")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.unique();
}
