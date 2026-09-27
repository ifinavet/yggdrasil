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
		status: v.union(
			v.literal("building"),
			v.literal("draft"),
			v.literal("approved"),
			v.literal("revoked"),
		),
		questions: v.array(reportQuestion),
		totalResponses: v.number(),
		registrants: v.optional(
			v.record(v.string(), v.record(v.string(), v.record(v.string(), v.number()))),
		),
		buildCursor: v.union(v.string(), v.null()),
		revision: v.number(),
		retentionAt: v.number(),
		approvedBy: v.optional(v.id("users")),
		approvedAt: v.optional(v.number()),
		tokenHash: v.optional(v.string()),
		emailId: v.optional(v.string()),
		deliveryAttempt: v.optional(v.number()),
		deliveryStatus: v.optional(
			v.union(
				v.literal("pending"),
				v.literal("queued"),
				v.literal("delivered"),
				v.literal("failed"),
			),
		),
	})
		.index("by_campaignId", ["campaignId"])
		.index("by_tokenHash", ["tokenHash"])
		.index("by_emailId", ["emailId"]),
	feedbackReportLocalEmails: defineTable({
		reportId: v.id("feedbackReports"),
		url: v.string(),
		html: v.string(),
		to: v.string(),
	}).index("by_reportId", ["reportId"]),
	feedbackReportAnswers: defineTable({
		reportId: v.id("feedbackReports"),
		responseId: v.id("formResponses"),
		fieldKey: v.string(),
		text: v.string(),
		visible: v.boolean(),
	})
		.index("by_reportId", ["reportId"])
		.index("by_reportId_and_visible", ["reportId", "visible"]),
};
