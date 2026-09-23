import { defineTable } from "convex/server";
import { v } from "convex/values";
import { feedbackField } from "../schema";

export const reportQuestion = feedbackField.extend({
	answered: v.number(),
	buckets: v.array(v.object({ value: v.string(), label: v.string(), count: v.number() })),
});
export const feedbackReportSchema = {
	feedbackReports: defineTable({
		campaignId: v.id("feedbackCampaigns"),
		eventId: v.id("events"),
		eventTitle: v.string(),
		eventStart: v.number(),
		companyName: v.string(),
		companyLogoId: v.optional(v.id("_storage")),
		recipientEmail: v.string(),
		status: v.union(v.literal("building"), v.literal("draft")),
		questions: v.array(reportQuestion),
		totalResponses: v.number(),
		buildCursor: v.union(v.string(), v.null()),
		revision: v.number(),
		retentionAt: v.number(),
	}).index("by_campaignId", ["campaignId"]),
	feedbackReportAnswers: defineTable({
		reportId: v.id("feedbackReports"),
		responseId: v.id("formResponses"),
		fieldKey: v.string(),
		text: v.string(),
		visible: v.boolean(),
	}).index("by_reportId", ["reportId"]).index("by_reportId_and_visible", ["reportId", "visible"]),
};
