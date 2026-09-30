import { defineTable } from "convex/server";
import { v } from "convex/values";

export const pointsSchema = {
	points: defineTable({
		studentId: v.id("students"),
		reason: v.string(),
		severity: v.number(),
		registrationId: v.optional(v.id("registrations")),
	})
		.index("by_studentId", ["studentId"])
		.index("by_registrationId", ["registrationId"]),
};
