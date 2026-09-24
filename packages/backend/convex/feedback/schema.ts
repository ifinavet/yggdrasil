import { defineTable } from "convex/server";
import { v } from "convex/values";

export const feedbackField = v.object({
	key: v.string(),
	type: v.union(v.literal("rating"), v.literal("text"), v.literal("yesNo"), v.literal("options")),
	label: v.string(),
	required: v.boolean(),
	options: v.optional(v.array(v.string())),
	allowOther: v.optional(v.boolean()),
	low: v.optional(v.string()),
	high: v.optional(v.string()),
	placeholder: v.optional(v.string()),
});
export const feedbackAnswers = v.record(
	v.string(),
	v.union(v.string(), v.number(), v.array(v.string())),
);
export const feedbackResponse = v.object({
	campaignId: v.id("feedbackCampaigns"),
	formVersionId: v.id("formVersions"),
	inviteId: v.id("feedbackInvites"),
	data: feedbackAnswers,
	submittedAt: v.number(),
});
export const feedbackSchema = {
	feedbackForms: defineTable({
		name: v.string(),
		isDefault: v.boolean(),
		draftFields: v.optional(v.array(feedbackField)),
	}).index("by_isDefault", ["isDefault"]),
	formVersions: defineTable({
		formDefinitionId: v.id("feedbackForms"),
		name: v.string(),
		publishedAt: v.number(),
		createdBy: v.optional(v.id("users")),
	})
		.index("by_publishedAt", ["publishedAt"])
		.index("by_formDefinitionId_and_publishedAt", ["formDefinitionId", "publishedAt"]),
	formFields: defineTable({
		...feedbackField.fields,
		formVersionId: v.id("formVersions"),
		order: v.number(),
	}).index("by_formVersionId_and_order", ["formVersionId", "order"]),
	feedbackCampaigns: defineTable({
		eventId: v.id("events"),
		formVersionId: v.optional(v.id("formVersions")),
		status: v.union(
			v.literal("scheduled"),
			v.literal("open"),
			v.literal("closed"),
			v.literal("cancelled"),
		),
		opensAt: v.number(),
		closesAt: v.number(),
		closedAt: v.optional(v.number()),
		retentionAt: v.optional(v.number()),
		retainedAt: v.optional(v.number()),
		legacy: v.optional(v.boolean()),
		generation: v.number(),
		workflowId: v.optional(v.string()),
		retentionWorkflowId: v.optional(v.string()),
		failure: v.optional(v.string()),
	})
		.index("by_eventId", ["eventId"])
		.index("by_status_and_opensAt", ["status", "opensAt"])
		.index("by_retentionAt", ["retentionAt"]),
	feedbackInvites: defineTable({
		campaignId: v.id("feedbackCampaigns"),
		userId: v.optional(v.id("users")),
		registrationId: v.optional(v.id("registrations")),
		responded: v.boolean(),
		bounced: v.boolean(),
		complained: v.boolean(),
		delivered: v.boolean(),
		sent: v.boolean(),
		workflowId: v.optional(v.string()),
		retainedAt: v.optional(v.number()),
		failure: v.optional(v.string()),
		sentBy: v.optional(v.id("users")),
		formVersionId: v.optional(v.id("formVersions")),
	})
		.index("by_campaignId", ["campaignId"])
		.index("by_campaignId_and_userId", ["campaignId", "userId"])
		.index("by_userId", ["userId"])
		.index("by_campaignId_and_retainedAt", ["campaignId", "retainedAt"]),
	feedbackTokens: defineTable({
		inviteId: v.id("feedbackInvites"),
		tokenHash: v.string(),
		deliveryId: v.id("feedbackDeliveries"),
	})
		.index("by_tokenHash", ["tokenHash"])
		.index("by_inviteId", ["inviteId"]),
	feedbackSummaries: defineTable({
		campaignId: v.id("feedbackCampaigns"),
		finalized: v.boolean(),
		invited: v.number(),
		responded: v.number(),
		sent: v.number(),
		delivered: v.number(),
		bounced: v.number(),
		complained: v.number(),
		distributions: v.record(v.string(), v.record(v.string(), v.number())),
	}).index("by_campaignId", ["campaignId"]),
	feedbackDeliveries: defineTable({
		campaignId: v.id("feedbackCampaigns"),
		inviteId: v.id("feedbackInvites"),
		round: v.number(),
		emailId: v.string(),
		queuedAt: v.number(),
		callbackAt: v.optional(v.number()),
		alertedAt: v.optional(v.number()),
		outcome: v.optional(v.union(v.literal("delivered"), v.literal("failed"))),
	})
		.index("by_inviteId_and_round", ["inviteId", "round"])
		.index("by_campaignId", ["campaignId"])
		.index("by_emailId", ["emailId"])
		.index("by_callbackAt_and_queuedAt", ["callbackAt", "queuedAt"]),
	// Only local development can create/read this capture. Production never stores plaintext token URLs here.
	feedbackLocalEmails: defineTable({
		deliveryId: v.id("feedbackDeliveries"),
		to: v.string(),
		subject: v.string(),
		html: v.string(),
		url: v.string(),
	}).index("by_deliveryId", ["deliveryId"]),
};
