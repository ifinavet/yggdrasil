import { WIKI_CATEGORY_KEYS, WIKI_FACT_KEYS } from "@workspace/shared/wiki";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { oneOf } from "../lib/validators";
export const articleValue = v.object({
	title: v.string(),
	slug: v.string(),
	excerpt: v.string(),
	content: v.string(),
	category: oneOf(WIKI_CATEGORY_KEYS),
	aliases: v.array(v.string()),
	facts: v.array(oneOf(WIKI_FACT_KEYS)),
});
export const wikiMetadata = {
	slug: v.optional(v.string()),
	category: v.optional(oneOf(WIKI_CATEGORY_KEYS)),
	aliases: v.optional(v.array(v.string())),
	facts: v.optional(v.array(oneOf(WIKI_FACT_KEYS))),
	searchText: v.optional(v.string()),
	plainText: v.optional(v.string()),
	editVersion: v.optional(v.number()),
};
export const wikiSchema = {
	wikiRevisions: defineTable({
		resourceId: v.id("resources"),
		article: articleValue,
		number: v.number(),
		action: v.string(),
		createdBy: v.optional(v.id("users")),
		createdAt: v.number(),
	}).index("by_resourceId_and_number", ["resourceId", "number"]),
};
