import { defineTable } from "convex/server";
import { v } from "convex/values";

export const eventSlackSchema = {
	slackSystemDeliveries: defineTable({
		channel: v.string(),
		clientMsgId: v.string(),
		text: v.string(),
		since: v.number(),
		status: v.union(v.literal("pending"), v.literal("sent"), v.literal("cancelled")),
		nextAttemptAt: v.number(),
		attempts: v.number(),
		leaseToken: v.optional(v.string()),
		leaseUntil: v.optional(v.number()),
		sentAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
	})
		.index("by_channel_and_clientMsgId", ["channel", "clientMsgId"])
		.index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"]),
	companySemesterSlackChannels: defineTable({
		companyId: v.id("companies"),
		semesterStart: v.number(),
		semesterEnd: v.number(),
		name: v.string(),
		slackChannelId: v.optional(v.string()),
		archived: v.boolean(),
		generation: v.optional(v.number()),
		creationNoticeChannelId: v.optional(v.string()),
		managedSlackUserIds: v.optional(v.array(v.string())),
		failureCount: v.optional(v.number()),
		retryAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
		leaseUntil: v.optional(v.number()),
		leaseToken: v.optional(v.string()),
	})
		.index("by_companyId_and_semesterStart", ["companyId", "semesterStart"])
		.index("by_name", ["name"]),
	eventSlackNotifications: defineTable({
		eventId: v.id("events"),
		key: v.string(),
		text: v.string(),
		condition: v.optional(v.string()),
		eventStart: v.number(),
		cancelledAt: v.optional(v.number()),
		sentAt: v.optional(v.number()),
		retryAt: v.optional(v.number()),
		failureCount: v.optional(v.number()),
		lastError: v.optional(v.string()),
	}).index("by_eventId_and_key", ["eventId", "key"]),
};
