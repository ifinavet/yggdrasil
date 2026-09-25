import { PRODUCT_CATEGORIES } from "@workspace/shared/products";
import { EVENT_TYPES } from "@workspace/shared/semester/labels";
import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import { oneOf } from "../lib/validators";

export const productCategory = oneOf(PRODUCT_CATEGORIES);

export const applicationEventType = oneOf(EVENT_TYPES);

export const volumeTier = v.object({
	quantity: v.number(),
	totalPriceOre: v.number(),
});

export const productFields = {
	name: v.string(),
	shortDescription: v.string(),
	longDescription: v.string(),
	category: productCategory,
	unitPriceOre: v.optional(v.number()),
	vatRate: v.number(),
	volumeTiers: v.optional(v.array(volumeTier)),
	startupPriceOre: v.optional(v.number()),
	maxStudents: v.optional(v.number()),
};

export const productSnapshot = v.object({
	productId: v.id("products"),
	name: v.string(),
	unitPriceOre: v.optional(v.number()),
});

export type ProductSnapshot = Infer<typeof productSnapshot>;

export const soldProductFields = {
	product: v.optional(productSnapshot),
	productGuessed: v.optional(v.boolean()),
};

export const productChangeAction = v.union(
	v.literal("created"),
	v.literal("updated"),
	v.literal("archived"),
	v.literal("restored"),
	v.literal("reordered"),
	v.literal("assigned"),
);

export const productFieldChange = v.object({
	field: v.string(),
	before: v.optional(v.string()),
	after: v.optional(v.string()),
});

export type ProductFieldChange = Infer<typeof productFieldChange>;

export const productsSchema = {
	products: defineTable({
		...productFields,
		eventType: v.optional(applicationEventType),
		sortOrder: v.number(),
		active: v.boolean(),
	})
		.index("by_active_and_sortOrder", ["active", "sortOrder"])
		.index("by_eventType_and_active", ["eventType", "active"])
		.index("by_sortOrder", ["sortOrder"])
		.index("by_category", ["category"])
		.index("by_name", ["name"]),

	productChanges: defineTable({
		productId: v.id("products"),
		changedBy: v.optional(v.id("users")),
		action: productChangeAction,
		changes: v.array(productFieldChange),
	}).index("by_productId", ["productId"]),
};
