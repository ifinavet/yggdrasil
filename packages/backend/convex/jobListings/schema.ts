import { defineTable } from "convex/server";
import { v } from "convex/values";

export const jobListingsSchema = {
    jobListings: defineTable({
        title: v.string(),
        type: v.string(),
        teaser: v.string(),
        description: v.string(),
        applicationUrl: v.string(),
        published: v.boolean(),
        company: v.id("companies"),
        deadline: v.number(),
    })
        .index("by_deadline", ["deadline"])
        .index("by_deadlineAndType", ["type", "deadline"])
        .index("by_deadlineAndPublished", ["published", "deadline"]),

    jobListingContacts: defineTable({
        listingId: v.id("jobListings"),
        name: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
    }).index("by_listingId", ["listingId"]),
}