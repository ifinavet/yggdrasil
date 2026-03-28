import { defineTable } from "convex/server";
import { v } from "convex/values";

export const eventsSchema = {
    events: defineTable({
        title: v.string(),
        teaser: v.string(),
        description: v.string(),
        eventStart: v.number(),
        registrationOpens: v.number(),
        participationLimit: v.number(),
        location: v.string(),
        food: v.string(),
        language: v.string(),
        ageRestriction: v.string(),
        externalUrl: v.optional(v.string()),
        hostingCompany: v.id("companies"),
        published: v.boolean(),
        slug: v.optional(v.string()),
        formId: v.optional(v.id("form")),
    })
        .index("by_eventStart", ["eventStart"])
        .index("by_registrationOpens", ["registrationOpens"])
        .index("by_slug", ["slug"]),

    eventOrganizers: defineTable({
        eventId: v.id("events"),
        userId: v.id("users"),
        role: v.union(v.literal("hovedansvarlig"), v.literal("medhjelper")),
    }).index("by_eventId", ["eventId"]),

    registrations: defineTable({
        eventId: v.id("events"),
        userId: v.id("users"),
        status: v.union(v.literal("registered"), v.literal("pending"), v.literal("waitlist")),
        note: v.optional(v.string()),
        registrationTime: v.number(),
        attendanceStatus: v.optional(
            v.union(v.literal("confirmed"), v.literal("late"), v.literal("no_show")),
        ),
        attendanceTime: v.optional(v.number()),
    })
        .index("by_eventId", ["eventId"])
        .index("by_eventIdAndRegistrationTime", ["eventId", "registrationTime"])
        .index("by_eventIdStatusAndRegistrationTime", ["eventId", "status", "registrationTime"])
        .index("by_userId", ["userId"]),
}