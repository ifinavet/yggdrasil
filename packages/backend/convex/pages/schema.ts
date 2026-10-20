import { defineTable } from "convex/server";
import { v } from "convex/values";

import { wikiMetadata } from "../wiki/schema";

export const pagesSchema = {
	resources: defineTable({
		...wikiMetadata,
		title: v.string(),
		content: v.string(),
		excerpt: v.string(),
		tag: v.optional(v.string()),
		favorite: v.optional(v.boolean()),
		icon: v.optional(v.string()),
		gradient: v.optional(v.string()),
		published: v.boolean(),
		updatedAt: v.number(),
	})
		.index("by_favoriteAndUpdated", ["favorite", "updatedAt"])
		.index("by_slug", ["slug"])
		.index("by_wikiStatus_and_updatedAt", ["wikiStatus", "updatedAt"])
		.index("by_wikiStatus_and_category_and_updatedAt", ["wikiStatus", "category", "updatedAt"])
		.searchIndex("search_wiki", {
			searchField: "searchText",
			filterFields: ["wikiStatus", "category"],
		}),

	externalPages: defineTable({
		identifier: v.string(),
		title: v.string(),
		content: v.string(),
		published: v.boolean(),
		updatedAt: v.number(),
	}).index("by_identifier", ["identifier"]),
};
