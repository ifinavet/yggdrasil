import {
	APPLICATION_STATUSES,
	ESCAPE_ANSWERS,
	EVENT_TYPES,
	FOOD_PURCHASERS,
	VENUES,
} from "@workspace/shared/semester/labels";
import { SEMESTER_TERMS } from "@workspace/shared/time";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { studentDegree } from "../users/students/schema";

/** A validator for one of the values in a shared tuple, so the schema and the labels agree. */
function oneOf<T extends string>(values: readonly [T, ...T[]]) {
	return v.union(...values.map((value) => v.literal(value)));
}

// Calendar days are Oslo-local "YYYY-MM-DD" strings, so a Tuesday never shifts with the time zone.
// Moments (sent, responded, consented) are epoch milliseconds, like the rest of the backend.

export const semesterTerm = oneOf(SEMESTER_TERMS);

// Whether companies can apply for the semester. `draft` means the semester exists but is not yet
// open for applications, `open` means it accepts them, and `closed` means the deadline has passed.
export const applicationPeriodStatus = v.union(
	v.literal("draft"),
	v.literal("open"),
	v.literal("closed"),
);

export const applicationStatus = oneOf(APPLICATION_STATUSES);

export const presentationEventType = oneOf(EVENT_TYPES);

export const venue = oneOf(VENUES);

export const wantsToUseEscape = oneOf(ESCAPE_ANSWERS);

// Who buys the food and drinks for the event.
export const foodPurchaser = oneOf(FOOD_PURCHASERS);

// Why a company cannot apply: deleted from, bankrupt or being wound up in Enhetsregisteret.
export const blockedReason = v.union(
	v.literal("deleted"),
	v.literal("bankrupt"),
	v.literal("liquidation"),
);

export const offerStatus = v.union(
	v.literal("pending"),
	v.literal("accepted"),
	v.literal("new_date_requested"),
	v.literal("declined"),
	v.literal("superseded"),
);

export const applicationActivityType = v.union(
	v.literal("submitted"),
	v.literal("status_changed"),
	v.literal("date_assigned"),
	v.literal("date_cleared"),
	v.literal("event_linked"),
);

// Who performed an activity: a Navet member, the company itself or the system.
export const activityActor = v.union(
	v.literal("internal"),
	v.literal("company"),
	v.literal("system"),
);

// A brreg code with its description, such as the organisation form or industry code.
const registryCode = v.object({
	code: v.string(),
	description: v.string(),
});

// The Enhetsregisteret entity as it was when the company applied, fetched again on the server at
// submission. Bifrost shows the application as submitted even if brreg changes later or is down.
export const brregSnapshotAtSubmission = v.object({
	name: v.string(),
	organizationForm: registryCode,
	businessAddress: v.optional(
		v.object({
			addressLines: v.array(v.string()),
			postalCode: v.optional(v.string()),
			city: v.optional(v.string()),
			countryCode: v.optional(v.string()),
		}),
	),
	industry: v.optional(registryCode),
	website: v.optional(v.string()),
	employeeCount: v.optional(v.number()),
	fetchedAt: v.number(),
});

export const applicationContact = v.object({
	name: v.string(),
	email: v.string(),
	phone: v.string(),
});

/** How Navet invoices the company: an email address, free text, or both. */
export const applicationBilling = v.object({
	email: v.optional(v.string()),
	details: v.optional(v.string()),
});

export const semesterPlanningSchema = {
	semesters: defineTable({
		year: v.number(),
		term: semesterTerm,
		// Set by a human in Bifrost. A semester created by the rollover cron starts without them.
		firstDate: v.optional(v.string()),
		lastDate: v.optional(v.string()),
		applicationDeadline: v.optional(v.string()),
		// With a hard deadline, Hugin stops taking applications after the deadline day. Otherwise
		// they are taken until an editor closes the semester.
		hardDeadline: v.optional(v.boolean()),
		status: applicationPeriodStatus,
		infoText: v.optional(v.string()),
		termsUrl: v.optional(v.string()),
		// When events made from the plan start, as "HH:mm". Set by a human in Bifrost.
		defaultEventStartTime: v.optional(v.string()),
		planFinalizedAt: v.optional(v.number()),
		planFinalizedBy: v.optional(v.id("users")),
	})
		.index("by_year_and_term", ["year", "term"])
		.index("by_status", ["status"]),

	semesterDates: defineTable({
		semesterId: v.id("semesters"),
		date: v.string(),
		closedLabel: v.optional(v.string()),
	}).index("by_semesterId_and_date", ["semesterId", "date"]),

	companyApplications: defineTable({
		semesterId: v.id("semesters"),
		// One-time id from the Hugin form, so a double click or retry saves one application.
		submissionId: v.optional(v.string()),
		formVersion: v.number(),
		orgNumber: v.string(),
		registry: brregSnapshotAtSubmission,
		contact: applicationContact,
		eventType: presentationEventType,
		minStudents: v.number(),
		maxStudents: v.number(),
		description: v.string(),
		availableDates: v.array(v.string()),
		datePreferences: v.optional(v.string()),
		venue: venue,
		wantsToUseEscape: wantsToUseEscape,
		foodAndDrinks: v.boolean(),
		foodPurchasedBy: foodPurchaser,
		billing: applicationBilling,
		targetDegrees: v.array(studentDegree),
		targetStudyPrograms: v.array(v.string()),
		additionalInfo: v.optional(v.string()),
		consent: v.object({
			version: v.string(),
			consentedAt: v.number(),
		}),

		status: applicationStatus,
		assignedDate: v.optional(v.string()),
		responsibleUserId: v.optional(v.id("users")),
		helperUserIds: v.optional(v.array(v.id("users"))),
		internalNotes: v.optional(v.string()),
		eventId: v.optional(v.id("events")),
	})
		.index("by_semesterId_and_status", ["semesterId", "status"])
		.index("by_semesterId_and_assignedDate", ["semesterId", "assignedDate"])
		.index("by_semesterId_and_orgNumber", ["semesterId", "orgNumber"])
		.index("by_eventId", ["eventId"])
		.index("by_submissionId", ["submissionId"]),

	companyApplicationOffers: defineTable({
		applicationId: v.id("companyApplications"),
		date: v.string(),
		eventType: presentationEventType,
		maxStudents: v.number(),
		// The token in the offer link. It is stored as is, so an editor can copy the link again for
		// Navet to email by hand; only editors can read it.
		linkToken: v.string(),
		sentAt: v.number(),
		sentBy: v.id("users"),
		status: offerStatus,
		respondedAt: v.optional(v.number()),
		acceptedTermsUrl: v.optional(v.string()),
		requestedDates: v.optional(v.array(v.string())),
	})
		.index("by_linkToken", ["linkToken"])
		.index("by_applicationId", ["applicationId"]),

	companyApplicationActivity: defineTable({
		applicationId: v.id("companyApplications"),
		type: applicationActivityType,
		actor: activityActor,
		actorUserId: v.optional(v.id("users")),
		fromStatus: v.optional(applicationStatus),
		toStatus: v.optional(applicationStatus),
		date: v.optional(v.string()),
		offerId: v.optional(v.id("companyApplicationOffers")),
		comment: v.optional(v.string()),
	}).index("by_applicationId", ["applicationId"]),
};
