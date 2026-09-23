import { defineTable } from "convex/server";
import { v } from "convex/values";
import { feedbackResponse } from "../feedback/schema";

export const formsSchema = {
	form: defineTable({
		formType: v.union(v.literal("event-feedback"), v.literal("listing-application")),
	}).index("by_formType", ["formType"]),

	formResponses: defineTable(
		v.union(
			v.object({
				formId: v.id("form"),
				data: v.record(v.string(), v.any()),
			}),
			feedbackResponse,
		),
	)
		.index("by_formId", ["formId"])
		.index("by_inviteId", ["inviteId"])
		.index("by_campaignId", ["campaignId"]),
};
