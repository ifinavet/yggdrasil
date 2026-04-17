import { defineTable } from "convex/server";
import { v } from "convex/values";

export const formsSchema = {
    form: defineTable({
        formType: v.union(v.literal("event-feedback"), v.literal("listing-application")),
    }).index("by_formType", ["formType"]),

    formResponses: defineTable({
        formId: v.id("form"),
        data: v.record(v.string(), v.any()),
    }).index("by_formId", ["formId"]),
}