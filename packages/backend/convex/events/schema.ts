import { ORGANIZER_ROLES } from "@workspace/shared/constants";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const organizerRoleValidator = v.union(...ORGANIZER_ROLES.map((role) => v.literal(role)));

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
		externalEvent: v.boolean(),
		externalUrl: v.optional(v.string()),
		hostingCompany: v.id("companies"),
		published: v.boolean(),
		feedbackEnabled: v.optional(v.boolean()),
		feedbackFormId: v.optional(v.id("feedbackForms")),
		slug: v.optional(v.string()),
		formId: v.optional(v.id("form")),
	})
		.index("by_eventStart", ["eventStart"])
		.index("by_registrationOpens", ["registrationOpens"])
		.index("by_slug", ["slug"])
		.index("by_formId", ["formId"]),

	eventOrganizers: defineTable({
		eventId: v.id("events"),
		userId: v.id("users"),
		role: organizerRoleValidator,
	})
		.index("by_eventId", ["eventId"])
		.index("by_eventId_and_userId", ["eventId", "userId"]),

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
		.index("by_userId", ["userId"])
		.index("by_eventId_and_userId", ["eventId", "userId"]),
};
