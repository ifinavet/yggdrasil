import { defineTable } from "convex/server";
import { v } from "convex/values";

export const feedbackTestSendSchema = {
	feedbackTestReportLinks: defineTable({
		eventId: v.id("events"),
		tokenHash: v.string(),
		expiresAt: v.number(),
	}).index("by_tokenHash", ["tokenHash"]),
};
