import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { findApplicationForEvent } from "./helper";

/**
 * Ticks off, or back on, the room booking and the food order for an event. Any internal member
 * can, since the kontaktperson and medhjelpere do the booking.
 *
 * @param {Id<"events">} eventId - The event.
 * @param {boolean} [roomBooked] - Whether the room is booked.
 * @param {boolean} [foodOrdered] - Whether the food is ordered.
 *
 * @throws - An error if the caller is not an internal member, or the event was not created from an
 * application.
 * @returns {null} - Returns null when saved.
 */
export const update = mutation({
	args: {
		eventId: v.id("events"),
		roomBooked: v.optional(v.boolean()),
		foodOrdered: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, { eventId, roomBooked, foodOrdered }) => {
		await requireRole(ctx, internalRoles);

		const application = await findApplicationForEvent(ctx, eventId);
		if (!application) throw new ConvexError("Arrangementet har ingen praktiske oppgaver.");

		await ctx.db.patch(application._id, {
			...(roomBooked !== undefined ? { roomBooked } : {}),
			...(foodOrdered !== undefined ? { foodOrdered } : {}),
		});
		return null;
	},
});
