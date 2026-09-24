import { logisticsNeeds } from "@workspace/shared/semester/logistics";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { findApplicationForEvent } from "./helper";

/**
 * What Navet must arrange for an event created from an application, and what is done. The needs
 * follow from the company's answers. Internal members see it on the event, where the
 * kontaktperson and medhjelpere tick it off.
 *
 * @param {Id<"events">} eventId - The event.
 *
 * @throws - An error if the caller is not an internal member.
 * @returns {{ roomNeeded: boolean, roomBooked: boolean, foodNeeded: boolean, foodOrdered: boolean } | null} - The logistics, or null for events not created from an application.
 */
export const getForEvent = query({
	args: { eventId: v.id("events") },
	returns: v.union(
		v.object({
			roomNeeded: v.boolean(),
			roomBooked: v.boolean(),
			foodNeeded: v.boolean(),
			foodOrdered: v.boolean(),
		}),
		v.null(),
	),
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);

		const application = await findApplicationForEvent(ctx, eventId);
		if (!application) return null;

		const needs = logisticsNeeds(application);
		return {
			roomNeeded: needs.room,
			roomBooked: application.roomBooked,
			foodNeeded: needs.food,
			foodOrdered: application.foodOrdered,
		};
	},
});
