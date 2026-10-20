import { WIKI_CATEGORY_KEYS, WIKI_FACT_KEYS } from "@workspace/shared/wiki";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { oneOf } from "../lib/validators";

export const articleFields = {
	title: v.string(),
	slug: v.string(),
	excerpt: v.string(),
	content: v.string(),
	category: oneOf(WIKI_CATEGORY_KEYS),
	aliases: v.array(v.string()),
	relatedSlugs: v.array(v.string()),
	facts: v.array(oneOf(WIKI_FACT_KEYS)),
	owner: v.string(),
	policy: v.boolean(),
};
export const articleValue = v.object(articleFields);
export const wikiMetadata = {
	slug: v.optional(v.string()),
	category: v.optional(oneOf(WIKI_CATEGORY_KEYS)),
	aliases: v.optional(v.array(v.string())),
	relatedSlugs: v.optional(v.array(v.string())),
	facts: v.optional(v.array(oneOf(WIKI_FACT_KEYS))),
	owner: v.optional(v.string()),
	policy: v.optional(v.boolean()),
	searchText: v.optional(v.string()),
	plainText: v.optional(v.string()),
	wikiStatus: v.optional(v.union(v.literal("published"), v.literal("draft"), v.literal("retired"))),
	revision: v.optional(v.number()),
	editVersion: v.optional(v.number()),
	hasDraft: v.optional(v.boolean()),
	createdBy: v.optional(v.id("users")),
	updatedBy: v.optional(v.id("users")),
	lastCheckedAt: v.optional(v.number()),
	lastCheckedBy: v.optional(v.id("users")),
	reviewDueAt: v.optional(v.number()),
	checkedSourceVersion: v.optional(v.string()),
	retirementNote: v.optional(v.string()),
	replacementSlug: v.optional(v.string()),
};
export const wikiSchema = {
	wikiDrafts: defineTable({
		resourceId: v.id("resources"),
		article: articleValue,
		updatedBy: v.id("users"),
		updatedAt: v.number(),
	}).index("by_resourceId", ["resourceId"]),
	wikiRevisions: defineTable({
		resourceId: v.id("resources"),
		article: articleValue,
		number: v.number(),
		action: v.string(),
		createdBy: v.optional(v.id("users")),
		createdAt: v.number(),
	}).index("by_resourceId_and_number", ["resourceId", "number"]),
	wikiBookmarks: defineTable({ userId: v.id("users"), resourceId: v.id("resources") }).index(
		"by_userId_and_resourceId",
		["userId", "resourceId"],
	),
	wikiReports: defineTable({
		resourceId: v.id("resources"),
		revision: v.number(),
		message: v.string(),
		createdBy: v.id("users"),
		resolved: v.boolean(),
		resolvedBy: v.optional(v.id("users")),
		resolvedAt: v.optional(v.number()),
	})
		.index("by_resolved", ["resolved"])
		.index("by_resourceId_and_resolved", ["resourceId", "resolved"]),
};
