import { defineTable } from "convex/server";
import { v } from "convex/values";

export const organizationSchema = {
    internals: defineTable({
        userId: v.id("users"),
        position: v.string(),
        group: v.string(),
        positionEmail: v.optional(v.string()),
        rank: v.optional(v.number()),
    })
        .index("by_position", ["position"])
        .index("by_userId", ["userId"]),

    internalGroups: defineTable({
        name: v.string(),
        description: v.string(),
        leader: v.id("users"),
    }),
}