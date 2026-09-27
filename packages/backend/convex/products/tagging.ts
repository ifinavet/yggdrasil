import { EVENT_SEMESTERS } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { eventsInSemester } from "../events/helper";
import { oneOf } from "../lib/validators";
import { recordChange } from "./helpers";
import { eventProductFields } from "./sales";

export const MAX_TAGGED_PER_BATCH = 200;

export const eventsForTagging = query({
	args: { semester: oneOf(EVENT_SEMESTERS), year: v.number() },
	handler: async (ctx, { semester, year }) => {
		await requireRole(ctx, adminRoles);
		const events = await eventsInSemester(ctx, semester, year);
		return await Promise.all(
			events
				.filter((event) => event.published)
				.map(async (event) => {
					const company = await ctx.db.get(event.hostingCompany);
					return {
						_id: event._id,
						title: event.title,
						eventStart: event.eventStart,
						participationLimit: event.participationLimit,
						companyName: company?.name ?? null,
						mainSponsor: company?.mainSponsor ?? false,
						product: event.product ?? null,
						productGuessed: event.productGuessed ?? false,
					};
				}),
		);
	},
});

export const bulkAssignEventProduct = mutation({
	args: { eventIds: v.array(v.id("events")), productId: v.id("products") },
	handler: async (ctx, { eventIds, productId }) => {
		const admin = await requireRole(ctx, adminRoles);
		if (eventIds.length === 0 || eventIds.length > MAX_TAGGED_PER_BATCH) {
			throw new ConvexError(`Velg mellom 1 og ${MAX_TAGGED_PER_BATCH} arrangementer.`);
		}

		const fields = await eventProductFields(ctx, productId);
		for (const eventId of eventIds) {
			const event = await ctx.db.get(eventId);
			if (!event) throw new ConvexError("Arrangementet ble ikke funnet.");
			await ctx.db.patch(eventId, fields);
		}

		await recordChange(ctx, {
			productId,
			changedBy: admin._id,
			action: "assigned",
			changes: [{ field: "assignedEvents", after: JSON.stringify(eventIds.length) }],
		});
		return eventIds.length;
	},
});
