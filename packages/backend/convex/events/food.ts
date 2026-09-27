import {
	FOOD_ITEM_LABELS,
	FOOD_ITEMS,
	type FoodItem,
	guessFoodItem,
	MAX_FOOD_NAME_LENGTH,
} from "@workspace/shared/events/food";
import { EVENT_SEMESTERS } from "@workspace/shared/time";
import { nameKey } from "@workspace/shared/utils";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { adminRoles, internalRoles, requireRole } from "../auth/accessRights";
import { oneOf } from "../lib/validators";
import { migrations } from "../migrations";
import { eventsInSemester } from "./helper";

export const MAX_FOOD_TAGGED_PER_BATCH = 200;
export const MAX_FOOD_ITEMS = 500;

export async function builtInFoodItemId(ctx: MutationCtx, slug: FoodItem) {
	const existing = await ctx.db
		.query("foodItems")
		.withIndex("by_slug", (q) => q.eq("slug", slug))
		.unique();
	if (existing) return existing._id;
	const name = FOOD_ITEM_LABELS[slug];
	return await ctx.db.insert("foodItems", { name, nameKey: nameKey(name), slug });
}

export async function requireFoodItem(ctx: QueryCtx, foodItemId: Id<"foodItems">) {
	const foodItem = await ctx.db.get(foodItemId);
	if (!foodItem) throw new ConvexError("Fant ikke matvalget.");
	return foodItem;
}

export const backfillEventFood = migrations.define({
	table: "events",
	migrateOne: async (ctx, event) => {
		if (event.foodItem) return;
		const guess = guessFoodItem(event.food);
		if (guess) return { foodItem: await builtInFoodItemId(ctx, guess), foodGuessed: true };
	},
});

const BACKFILL = internal.events.food.backfillEventFood;

export const backfillPending = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		const [status] = await migrations.getStatus(ctx, { migrations: [BACKFILL] });
		return status?.state !== "success";
	},
});

export const setupBackfill = mutation({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		for (const slug of FOOD_ITEMS) await builtInFoodItemId(ctx, slug);
		await migrations.runOne(ctx, BACKFILL);
	},
});

export const listFoodItems = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		const foodItems = await ctx.db.query("foodItems").take(MAX_FOOD_ITEMS);
		return foodItems
			.sort((a, b) => a.nameKey.localeCompare(b.nameKey, "nb"))
			.map(({ _id, name }) => ({ _id, name }));
	},
});

export const createFoodItem = mutation({
	args: { name: v.string() },
	handler: async (ctx, args) => {
		await requireRole(ctx, adminRoles);
		const name = args.name.trim().replace(/\s+/g, " ");
		const key = nameKey(name);
		if (!key) throw new ConvexError("Matvalget må ha et navn.");
		if (name.length > MAX_FOOD_NAME_LENGTH) {
			throw new ConvexError(`Navnet kan være maks ${MAX_FOOD_NAME_LENGTH} tegn.`);
		}

		const existing = await ctx.db
			.query("foodItems")
			.withIndex("by_nameKey", (q) => q.eq("nameKey", key))
			.first();
		if (existing) return existing._id;
		return await ctx.db.insert("foodItems", { name, nameKey: key });
	},
});

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
	args: { eventIds: v.array(v.id("events")), foodItem: v.id("foodItems") },
	handler: async (ctx, { eventIds, foodItem }) => {
		await requireRole(ctx, adminRoles);
		if (eventIds.length === 0 || eventIds.length > MAX_FOOD_TAGGED_PER_BATCH) {
			throw new ConvexError(`Velg mellom 1 og ${MAX_FOOD_TAGGED_PER_BATCH} arrangementer.`);
		}
		await requireFoodItem(ctx, foodItem);

		for (const eventId of eventIds) {
			const event = await ctx.db.get(eventId);
			if (!event) throw new ConvexError("Arrangementet ble ikke funnet.");
			await ctx.db.patch(eventId, { foodItem, foodGuessed: undefined });
		}
		return eventIds.length;
	},
});
