import { vWorkflowId } from "@convex-dev/workflow";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { EMAIL_DELIVERY_STATUSES } from "../lib/emailDelivery";
import { oneOf } from "../lib/validators";

export const availabilityWindow = v.object({ day: v.string(), start: v.number(), end: v.number() });
export const interviewerSelection = v.object({
	userId: v.id("users"),
	selectedCalendarIds: v.array(v.string()),
});
export const decisionValue = oneOf(["pending", "shortlist", "accepted", "rejected"]);
export const admissionGroupChoice = v.union(v.id("internalGroups"), v.literal("unsure"));

export const operationValidator = v.object({
	kind: oneOf([
		"publish",
		"send_decision",
		"cancel_interview",
		"offer_declined",
		"archive_channel",
		"remind_3d",
		"remind_1d",
		"delivery_failure",
		"sync_channel",
	]),
	periodId: v.id("admissionPeriods"),
	applicationId: v.optional(v.id("admissionApplications")),
	interviewId: v.optional(v.id("admissionInterviews")),
	deliveryId: v.optional(v.id("admissionDeliveries")),
	revision: v.number(),
	idempotencyKey: v.string(),
	dueAt: v.number(),
	refillEligible: v.optional(v.boolean()),
	notifyApplicant: v.optional(v.boolean()),
});

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
		status: oneOf(["draft", "open", "published", "closing"]),
		revision: v.number(),
		slackManagedMemberIds: v.optional(v.array(v.string())),
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
		group: v.optional(admissionGroupChoice),
		availability: v.array(availabilityWindow),
		consentedAt: v.optional(v.number()),
		consentVersion: v.optional(v.string()),
		status: oneOf(["draft", "submitted", "withdrawn"]),
		revision: v.number(),
		decisionRevision: v.number(),
		notes: v.optional(v.string()),
		decision: decisionValue,
		reviewedGroup: v.optional(v.string()),
		reviewedGroupId: v.optional(v.id("internalGroups")),
		reviewedWorkspaceEmail: v.optional(v.string()),
		decisionAt: v.optional(v.number()),
		decisionBy: v.optional(v.id("users")),
		decisionQueuedAt: v.optional(v.number()),
		decisionSentAt: v.optional(v.number()),
		offerStatus: oneOf(["none", "pending", "accepted", "declined", "expired"]),
		offerDeadline: v.optional(v.number()),
		offerRespondedAt: v.optional(v.number()),
		onboardingStartedAt: v.optional(v.number()),
	})
		.index("by_periodId_and_userId", ["periodId", "userId"])
		.index("by_userId_and_status", ["userId", "status"])
		.index("by_periodId_and_status", ["periodId", "status"])
		.index("by_group", ["group"])
		.index("by_reviewedGroupId", ["reviewedGroupId"]),
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
		candidateConfirmedOutsideForm: v.optional(v.boolean()),
		status: oneOf(["scheduled", "cancelled"]),
		revision: v.number(),
	})
		.index("by_applicationId", ["applicationId"])
		.index("by_periodId_and_status", ["periodId", "status"]),
	admissionWorkflows: defineTable({
		kind: operationValidator.fields.kind,
		periodId: v.id("admissionPeriods"),
		idempotencyKey: v.string(),
		workflowId: vWorkflowId,
		completedAt: v.optional(v.number()),
	})
		.index("by_periodId", ["periodId"])
		.index("by_periodId_and_completedAt", ["periodId", "completedAt"])
		.index("by_periodId_and_kind", ["periodId", "kind"])
		.index("by_idempotencyKey", ["idempotencyKey"]),
	admissionDeliveries: defineTable({
		periodId: v.id("admissionPeriods"),
		applicationId: v.id("admissionApplications"),
		kind: oneOf([
			"offer",
			"rejection",
			"interview_invite",
			"cancelled",
			"reminder_3d",
			"reminder_1d",
		]),
		idempotencyKey: v.string(),
		emailId: v.string(),
		status: oneOf(EMAIL_DELIVERY_STATUSES),
		error: v.optional(v.string()),
	})
		.index("by_emailId", ["emailId"])
		.index("by_periodId", ["periodId"])
		.index("by_periodId_and_status", ["periodId", "status"])
		.index("by_idempotencyKey", ["idempotencyKey"]),
};
