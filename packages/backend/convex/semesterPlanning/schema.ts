import { defineTable } from "convex/server";
import { v } from "convex/values";
import { studentDegree } from "../users/students/schema";

// Calendar days are Oslo-local "YYYY-MM-DD" strings, so a Tuesday never shifts with the time zone.
// Moments (sent, responded, consented) are epoch milliseconds, like the rest of the backend.

export const semesterTerm = v.union(v.literal("spring"), v.literal("autumn"));

// Whether companies can apply for the semester. `draft` means the semester exists but is not yet
// open for applications, `open` means it accepts them, and `closed` means the deadline has passed.
export const applicationPeriodStatus = v.union(
	v.literal("draft"),
	v.literal("open"),
	v.literal("closed"),
);

export const applicationStatus = v.union(
	v.literal("applied"),
	v.literal("offer_sent"),
	v.literal("new_date_requested"),
	v.literal("confirmed"),
	v.literal("rejected"),
	v.literal("withdrawn"),
);

export const presentationEventType = v.union(
	v.literal("standard_presentation"),
	v.literal("large_presentation"),
	v.literal("workshop"),
	v.literal("social"),
);

export const venue = v.union(
	v.literal("campus"),
	v.literal("own_premises"),
	v.literal("undecided"),
);

export const wantsToUseEscape = v.union(v.literal("yes"), v.literal("no"), v.literal("unsure"));

// Who buys the food and drinks for the event.
export const foodPurchaser = v.union(
	v.literal("company"),
	v.literal("navet"),
	v.literal("undecided"),
);

export const peppolLookup = v.union(
	v.literal("found"),
	v.literal("not_found"),
	v.literal("failed"),
);

export const offerStatus = v.union(
	v.literal("pending"),
	v.literal("accepted"),
	v.literal("new_date_requested"),
	v.literal("superseded"),
);

export const applicationActivityType = v.union(
	v.literal("submitted"),
	v.literal("status_changed"),
	v.literal("date_assigned"),
	v.literal("date_cleared"),
	v.literal("company_linked"),
	v.literal("event_linked"),
	v.literal("contact_changed"),
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

export const applicationBilling = v.object({
	email: v.string(),
	ehf: v.boolean(),
	reference: v.optional(v.string()),
	peppolLookup: peppolLookup,
	peppolCheckedAt: v.number(),
});

export const semesterPlanningSchema = {
	semesters: defineTable({
		year: v.number(),
		term: semesterTerm,
		// Set by a human in Bifrost. A semester created by the rollover cron starts without them.
		firstDate: v.optional(v.string()),
		lastDate: v.optional(v.string()),
		applicationDeadline: v.optional(v.string()),
		status: applicationPeriodStatus,
		infoText: v.optional(v.string()),
		termsUrl: v.optional(v.string()),
		offerResponseDays: v.optional(v.number()),
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
		formVersion: v.number(),
		orgNumber: v.string(),
		registry: brregSnapshotAtSubmission,
		contact: applicationContact,
		filledInByEmail: v.optional(v.string()),
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
		companyId: v.optional(v.id("companies")),
		responsibleUserId: v.optional(v.id("users")),
		room: v.optional(v.string()),
		roomBooked: v.boolean(),
		foodOrdered: v.boolean(),
		internalNotes: v.optional(v.string()),
		eventId: v.optional(v.id("events")),
	})
		.index("by_semesterId_and_status", ["semesterId", "status"])
		.index("by_semesterId_and_assignedDate", ["semesterId", "assignedDate"])
		.index("by_semesterId_and_orgNumber", ["semesterId", "orgNumber"])
		.index("by_companyId", ["companyId"])
		.index("by_eventId", ["eventId"]),

	companyApplicationOffers: defineTable({
		applicationId: v.id("companyApplications"),
		date: v.string(),
		eventType: presentationEventType,
		maxStudents: v.number(),
		tokenHash: v.string(),
		sentAt: v.number(),
		sentBy: v.id("users"),
		status: offerStatus,
		respondBy: v.optional(v.number()),
		respondedAt: v.optional(v.number()),
		acceptedTermsUrl: v.optional(v.string()),
		requestedDates: v.optional(v.array(v.string())),
		responseComment: v.optional(v.string()),
	})
		.index("by_tokenHash", ["tokenHash"])
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
