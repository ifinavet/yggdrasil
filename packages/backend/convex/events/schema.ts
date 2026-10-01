import { ORGANIZER_ROLES, REGISTRATION_STATUSES } from "@workspace/shared/constants";
import { FOOD_ITEMS } from "@workspace/shared/events/food";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { oneOf } from "../lib/validators";
import { soldProductFields } from "../products/schema";
import { REMINDER_KINDS } from "./reminders/schedule";

export const organizerRoleValidator = v.union(...ORGANIZER_ROLES.map((role) => v.literal(role)));
export const registrationStatusValidator = v.union(
	...REGISTRATION_STATUSES.map((status) => v.literal(status)),
);

export const editableEventFields = {
	title: v.string(),
	teaser: v.string(),
	description: v.string(),
	eventStart: v.number(),
	registrationOpens: v.number(),
	participationLimit: v.number(),
	location: v.string(),
	foodItem: v.optional(v.id("foodItems")),
	language: v.string(),
	ageRestriction: v.string(),
	externalEvent: v.boolean(),
	externalUrl: v.optional(v.string()),
	hostingCompany: v.id("companies"),
	published: v.boolean(),
};

export const eventsSchema = {
	events: defineTable({
		...editableEventFields,
		food: v.optional(v.string()),
		foodGuessed: v.optional(v.boolean()),
		feedbackEnabled: v.optional(v.boolean()),
		remindersEnabled: v.optional(v.boolean()),
		completedChecklistSteps: v.optional(v.array(v.string())),
		feedbackFormId: v.optional(v.id("feedbackForms")),
		slug: v.optional(v.string()),
		formId: v.optional(v.id("form")),
		...soldProductFields,
	})
		.index("by_eventStart", ["eventStart"])
		.index("by_registrationOpens", ["registrationOpens"])
		.index("by_slug", ["slug"])
		.index("by_formId", ["formId"])
		.index("by_hostingCompany_and_eventStart", ["hostingCompany", "eventStart"]),
	eventRegistrationOpenNotices: defineTable({
		eventId: v.id("events"),
		registrationOpens: v.number(),
		sentAt: v.optional(v.number()),
		queuedAt: v.optional(v.number()),
	}).index("by_eventId_and_registrationOpens", ["eventId", "registrationOpens"]),

	foodItems: defineTable({
		name: v.string(),
		nameKey: v.string(),
		slug: v.optional(oneOf(FOOD_ITEMS)),
	})
		.index("by_slug", ["slug"])
		.index("by_nameKey", ["nameKey"]),

	eventOrganizers: defineTable({
		eventId: v.id("events"),
		userId: v.id("users"),
		role: organizerRoleValidator,
	})
		.index("by_eventId", ["eventId"])
		.index("by_eventId_and_userId", ["eventId", "userId"])
		.index("by_userId", ["userId"]),

	registrations: defineTable({
		eventId: v.id("events"),
		userId: v.id("users"),
		status: registrationStatusValidator,
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
		.index("by_userIdAndStatus", ["userId", "status"])
		.index("by_eventId_and_userId", ["eventId", "userId"]),

	eventReminders: defineTable({
		eventId: v.id("events"),
		kind: oneOf(REMINDER_KINDS),
		queuedAt: v.number(),
	}).index("by_eventId_and_kind", ["eventId", "kind"]),
	eventReminderDeliveries: defineTable({
		eventStart: v.number(),
		eventId: v.id("events"),
		kind: oneOf(REMINDER_KINDS),
		userId: v.id("users"),
		emailId: v.string(),
		sent: v.boolean(),
		sentAt: v.optional(v.number()),
	})
		.index("by_emailId", ["emailId"])
		.index("by_eventId_and_kind_and_userId", ["eventId", "kind", "userId"]),
};
