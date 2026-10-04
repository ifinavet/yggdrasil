import { defineTable } from "convex/server";
import { v } from "convex/values";

export const availabilityWindow = v.object({ day: v.string(), start: v.number(), end: v.number() });
export const interviewerSelection = v.object({
	userId: v.id("users"),
	selectedCalendarIds: v.array(v.string()),
});
export const decisionValue = v.union(
	v.literal("pending"),
	v.literal("shortlist"),
	v.literal("accepted"),
	v.literal("rejected"),
);

const roundSnapshot = v.object({
	decisions: v.array(
		v.object({ applicationId: v.id("admissionApplications"), decision: decisionValue }),
	),
});

export const admissionsSchema = {
	admissionPeriods: defineTable({
		title: v.string(),
		applicationStartAt: v.number(),
		applicationEndAt: v.number(),
		interviewStartAt: v.number(),
		interviewEndAt: v.number(),
		retentionAt: v.number(),
		status: v.union(
			v.literal("draft"),
			v.literal("open"),
			v.literal("published"),
			v.literal("closing"),
		),
		revision: v.number(),
		interviewers: v.array(interviewerSelection),
		duration: v.number(),
		buffer: v.number(),
		breakEvery: v.number(),
		breakMinutes: v.number(),
		lunch: v.boolean(),
		room: v.string(),
		dayStart: v.number(),
		dayEnd: v.number(),
		breaks: v.array(availabilityWindow),
		timezone: v.string(),
		round: v.number(),
		roundHistory: v.array(roundSnapshot),
		createdBy: v.id("users"),
		updatedBy: v.id("users"),
	})
		.index("by_status", ["status"])
		.index("by_retentionAt", ["retentionAt"]),
	admissionApplications: defineTable({
		periodId: v.id("admissionPeriods"),
		userId: v.id("users"),
		studentProfile: v.optional(
			v.object({
				name: v.string(),
				studyProgram: v.string(),
				year: v.number(),
				degree: v.string(),
			}),
		),
		about: v.optional(v.string()),
		motivation: v.optional(v.string()),
		group: v.optional(v.string()),
		availability: v.array(availabilityWindow),
		consentedAt: v.optional(v.number()),
		consentVersion: v.optional(v.string()),
		status: v.union(v.literal("draft"), v.literal("submitted"), v.literal("withdrawn")),
		revision: v.number(),
		decisionRevision: v.number(),
		notes: v.optional(v.string()),
		decision: decisionValue,
		reviewedGroup: v.optional(v.string()),
		reviewedWorkspaceEmail: v.optional(v.string()),
		decisionAt: v.optional(v.number()),
		decisionBy: v.optional(v.id("users")),
		decisionQueuedAt: v.optional(v.number()),
		decisionSentAt: v.optional(v.number()),
		offerStatus: v.union(
			v.literal("none"),
			v.literal("pending"),
			v.literal("accepted"),
			v.literal("declined"),
			v.literal("expired"),
		),
		offerDeadline: v.optional(v.number()),
		offerRespondedAt: v.optional(v.number()),
		onboardingStartedAt: v.optional(v.number()),
		sent: v.boolean(),
	})
		.index("by_periodId_and_userId", ["periodId", "userId"])
		.index("by_userId_and_status", ["userId", "status"])
		.index("by_periodId_and_status", ["periodId", "status"]),
	admissionInterviews: defineTable({
		periodId: v.id("admissionPeriods"),
		applicationId: v.id("admissionApplications"),
		startAt: v.number(),
		endAt: v.number(),
		interviewerIds: v.array(v.id("users")),
		selectedCalendarIds: v.array(v.string()),
		room: v.string(),
		calendarEventId: v.optional(v.string()),
		publishedAt: v.optional(v.number()),
		status: v.union(v.literal("scheduled"), v.literal("cancelled")),
		revision: v.number(),
	})
		.index("by_applicationId", ["applicationId"])
		.index("by_periodId_and_status", ["periodId", "status"]),
	admissionOutbox: defineTable({
		kind: v.union(
			v.literal("publish"),
			v.literal("send_decision"),
			v.literal("cancel_interview"),
			v.literal("offer_declined"),
			v.literal("archive_channel"),
			v.literal("remind_3d"),
			v.literal("remind_1d"),
			v.literal("delivery_failure"),
		),
		periodId: v.id("admissionPeriods"),
		applicationId: v.optional(v.id("admissionApplications")),
		interviewId: v.optional(v.id("admissionInterviews")),
		deliveryId: v.optional(v.id("admissionDeliveries")),
		revision: v.number(),
		idempotencyKey: v.string(),
		state: v.union(
			v.literal("pending"),
			v.literal("running"),
			v.literal("done"),
			v.literal("failed"),
		),
		attempts: v.number(),
		nextAttemptAt: v.number(),
		lastError: v.optional(v.string()),
		createdAt: v.number(),
		result: v.optional(
			v.object({
				calendarEventId: v.optional(v.string()),
				deliveryIds: v.optional(v.array(v.string())),
			}),
		),
		refillEligible: v.optional(v.boolean()),
	})
		.index("by_idempotencyKey", ["idempotencyKey"])
		.index("by_state_and_nextAttemptAt", ["state", "nextAttemptAt"])
		.index("by_periodId", ["periodId"])
		.index("by_periodId_and_kind", ["periodId", "kind"])
		.index("by_periodId_and_kind_and_state", ["periodId", "kind", "state"])
		.index("by_periodId_and_state", ["periodId", "state"])
		.index("by_periodId_and_kind_and_state_and_attempts", [
			"periodId",
			"kind",
			"state",
			"attempts",
		]),
	admissionDeliveries: defineTable({
		periodId: v.id("admissionPeriods"),
		applicationId: v.id("admissionApplications"),
		kind: v.union(
			v.literal("offer"),
			v.literal("rejection"),
			v.literal("interview_invite"),
			v.literal("cancelled"),
			v.literal("reminder_3d"),
			v.literal("reminder_1d"),
		),
		idempotencyKey: v.string(),
		emailId: v.string(),
		localPreview: v.optional(v.object({ to: v.string(), subject: v.string(), html: v.string() })),
		status: v.union(
			v.literal("queued"),
			v.literal("sent"),
			v.literal("delivered"),
			v.literal("delayed"),
			v.literal("failed"),
			v.literal("bounced"),
			v.literal("complained"),
		),
		error: v.optional(v.string()),
	})
		.index("by_emailId", ["emailId"])
		.index("by_periodId", ["periodId"])
		.index("by_idempotencyKey", ["idempotencyKey"]),
};
