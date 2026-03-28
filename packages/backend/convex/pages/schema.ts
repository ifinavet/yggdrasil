import { defineTable } from "convex/server";
import { v } from "convex/values";

export const pagesSchema = {
    resources: defineTable({
        title: v.string(),
        content: v.string(),
        excerpt: v.string(),
        tag: v.optional(v.string()),
        favorite: v.optional(v.boolean()),
        icon: v.optional(v.string()),
        gradient: v.optional(v.string()),
        published: v.boolean(),
        updatedAt: v.number(),
    }).index("by_favoriteAndUpdated", ["favorite", "updatedAt"]),

    externalPages: defineTable({
        identifier: v.string(),
        title: v.string(),
        content: v.string(),
        published: v.boolean(),
        updatedAt: v.number(),
    }).index("by_identifier", ["identifier"]),
}