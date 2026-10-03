import { defineTable } from "convex/server";
import { v } from "convex/values";
import { oneOf } from "../../lib/validators";
import { presentationEventType } from "../../semesterPlanning/schema";

const answer = oneOf(["yes", "no", "unsure"]);
export const answers = v.object({
	requestedEventType: v.optional(presentationEventType),
	title: v.string(),
	teaser: v.string(),
	description: v.string(),
	location: v.string(),
	food: v.string(),
	notes: v.string(),
	standDetails: v.string(),
	capacity: v.number(),
	startTime: v.string(),
	venue: oneOf(["campus", "escape", "own", "other", "unsure"]),
	foodAndDrinks: answer,
	foodPurchasedBy: oneOf(["company", "navet", "undecided"]),
	alcohol: answer,
	ageRestriction: oneOf(["18", "none", "unsure"]),
	stand: answer,
	language: v.string(),
});
export const preparation = {
	contactName: v.string(),
	contactEmail: v.string(),
	signature: v.string(),
	eventType: v.optional(presentationEventType),
	answers,
};
export const envelope = v.object({
	from: v.string(),
	to: v.string(),
	cc: v.array(v.string()),
	replyTo: v.array(v.string()),
	subject: v.string(),
	text: v.string(),
});
export const planningSchema = {
	eventPlanning: defineTable({
		eventId: v.id("events"),
		...preparation,
		companyId: v.id("companies"),
		revision: v.number(),
		generation: v.number(),
		tokenHash: v.optional(v.string()),
		status: oneOf(["preparing", "invited", "manual", "closed"]),
		latestSubmissionId: v.optional(v.id("eventPlanningSubmissions")),
		sentAt: v.optional(v.number()),
		sentBy: v.optional(v.id("users")),
		manualNote: v.optional(v.string()),
		resolvedAt: v.optional(v.number()),
		resolvedBy: v.optional(v.id("users")),
		error: v.optional(v.string()),
	})
		.index("by_eventId", ["eventId"])
		.index("by_tokenHash", ["tokenHash"]),
	eventPlanningSubmissions: defineTable({
		planningId: v.id("eventPlanning"),
		submissionId: v.string(),
		generation: v.number(),
		answers,
		draft: answers,
		baseEvent: v.string(),
		eventDate: v.string(),
		revision: v.number(),
		status: oneOf(["awaiting_email", "ready", "approved", "superseded"]),
		confirmedAt: v.optional(v.number()),
		decidedAt: v.optional(v.number()),
		decidedBy: v.optional(v.id("users")),
	})
		.index("by_planningId", ["planningId"])
		.index("by_submissionId", ["submissionId"]),
	eventPlanningConfirmations: defineTable({
		submissionId: v.id("eventPlanningSubmissions"),
		tokenHash: v.string(),
		expiresAt: v.number(),
		usedAt: v.optional(v.number()),
	})
		.index("by_tokenHash", ["tokenHash"])
		.index("by_submissionId", ["submissionId"]),
	eventPlanningEmails: defineTable({
		planningId: v.id("eventPlanning"),
		submissionId: v.optional(v.id("eventPlanningSubmissions")),
		kind: oneOf(["invitation", "confirmation"]),
		generation: v.number(),
		eventStart: v.number(),
		envelope,
		url: v.optional(v.string()),
		status: oneOf([
			"pending",
			"queued",
			"sent",
			"delivered",
			"delayed",
			"failed",
			"bounced",
			"complained",
			"cancelled",
		]),
		emailId: v.optional(v.string()),
		error: v.optional(v.string()),
		attempts: v.number(),
		nextAttemptAt: v.number(),
		sentAt: v.optional(v.number()),
		deliveredAt: v.optional(v.number()),
		resolvedAt: v.optional(v.number()),
		resolvedBy: v.optional(v.id("users")),
		resolution: v.optional(v.string()),
	})
		.index("by_planningId", ["planningId"])
		.index("by_emailId", ["emailId"])
		.index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"]),
};
