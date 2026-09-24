import { defineTable } from "convex/server";
import { v } from "convex/values";

export const slackSchema = {
	bedpresChannels: defineTable({
		eventId: v.id("events"),
		channelId: v.string(),
		channelName: v.string(),
		status: v.union(v.literal("active"), v.literal("archived")),
		sentReminders: v.array(v.string()),
		invitedUserIds: v.array(v.id("users")),
		// Organizers without a Slack account are announced once, but looked up again every run.
		reportedMissingUserIds: v.array(v.id("users")),
		archivedAt: v.optional(v.number()),
	})
		.index("by_eventId", ["eventId"])
		.index("by_status", ["status"]),
};
