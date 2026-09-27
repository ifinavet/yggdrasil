import { guessFoodItem } from "@workspace/shared/events/food";
import { EVENT_SEMESTERS } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { oneOf } from "../lib/validators";
import { migrations } from "../migrations";
import { eventsInSemester } from "./helper";
import { foodItemValidator } from "./schema";

export const MAX_FOOD_TAGGED_PER_BATCH = 200;

export const backfillEventFood = migrations.define({
	table: "events",
	migrateOne: (_ctx, event) => {
		if (event.foodItem) return;
		const guess = guessFoodItem(event.food);
		if (guess) return { foodItem: guess, foodGuessed: true };
	},
});

export const runBackfillEventFood = migrations.runner(internal.events.food.backfillEventFood);

export const eventsForFoodTagging = query({
	args: { semester: oneOf(EVENT_SEMESTERS), year: v.number() },
	handler: async (ctx, { semester, year }) => {
		await requireRole(ctx, adminRoles);
		const events = await eventsInSemester(ctx, semester, year);
		return await Promise.all(
			events.map(async (event) => {
				const company = await ctx.db.get(event.hostingCompany);
				return {
					_id: event._id,
					title: event.title,
					eventStart: event.eventStart,
					published: event.published,
					companyName: company?.name ?? null,
					food: event.food ?? null,
					foodItem: event.foodItem ?? null,
					foodGuessed: event.foodGuessed ?? false,
				};
			}),
		);
	},
});

export const bulkAssignFoodItem = mutation({
	args: { eventIds: v.array(v.id("events")), foodItem: foodItemValidator },
	handler: async (ctx, { eventIds, foodItem }) => {
		await requireRole(ctx, adminRoles);
		if (eventIds.length === 0 || eventIds.length > MAX_FOOD_TAGGED_PER_BATCH) {
			throw new ConvexError(`Velg mellom 1 og ${MAX_FOOD_TAGGED_PER_BATCH} arrangementer.`);
		}

		for (const eventId of eventIds) {
			const event = await ctx.db.get(eventId);
			if (!event) throw new ConvexError("Arrangementet ble ikke funnet.");
			await ctx.db.patch(eventId, { foodItem, foodGuessed: undefined });
		}
		return eventIds.length;
	},
});
