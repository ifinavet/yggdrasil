import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../convex/_generated/dataModel";

const DAY = 24 * 60 * 60 * 1000;

export function periodFields(
	userId: Id<"users">,
	overrides: Partial<WithoutSystemFields<Doc<"admissionPeriods">>> = {},
): WithoutSystemFields<Doc<"admissionPeriods">> {
	const now = Date.now();
	return {
		title: "Høst 2026",
		applicationStartAt: now - 1_000,
		applicationEndAt: now + DAY,
		interviewStartAt: now + 2 * DAY,
		interviewEndAt: now + 7 * DAY,
		retentionAt: now + 14 * DAY,
		status: "open",
		revision: 1,
		interviewers: [],
		duration: 15,
		buffer: 5,
		breakEvery: 3,
		breakMinutes: 15,
		lunch: true,
		room: "Beta",
		dayStart: 540,
		dayEnd: 960,
		breaks: [],
		timezone: "Europe/Oslo",
		round: 1,
		roundHistory: [],
		createdBy: userId,
		updatedBy: userId,
		...overrides,
	};
}

export function applicationFields(
	periodId: Id<"admissionPeriods">,
	userId: Id<"users">,
	overrides: Partial<WithoutSystemFields<Doc<"admissionApplications">>> = {},
): WithoutSystemFields<Doc<"admissionApplications">> {
	return {
		periodId,
		userId,
		availability: [],
		status: "submitted",
		revision: 1,
		decisionRevision: 0,
		decision: "pending",
		offerStatus: "none",
		sent: false,
		...overrides,
	};
}

export function interviewFields(
	periodId: Id<"admissionPeriods">,
	applicationId: Id<"admissionApplications">,
	overrides: Partial<WithoutSystemFields<Doc<"admissionInterviews">>> = {},
): WithoutSystemFields<Doc<"admissionInterviews">> {
	const startAt = Date.now() + 2 * DAY;
	return {
		periodId,
		applicationId,
		startAt,
		endAt: startAt + 15 * 60 * 1000,
		interviewerIds: [],
		selectedCalendarIds: [],
		room: "Beta",
		status: "scheduled",
		revision: 1,
		...overrides,
	};
}
