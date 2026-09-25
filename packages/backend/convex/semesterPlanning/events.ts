import { EVENT_TITLE_PREFIX } from "@workspace/shared/semester/labels";
import { osloDateTimeToEpoch, osloToday } from "@workspace/shared/semester/time";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { insertEventWithOrganizers } from "../events/helper";
import { type Actor, logApplicationActivity } from "./applicationLifecycle";
import { findCompanyProfile, requireValidHelpers } from "./applications/helper";
import { requireSemester } from "./semesters/helper";

// Helpers for the events semester planning makes. They register no Convex functions.

const PLACEHOLDER = "Mer info kommer";

/**
 * Makes sure a confirmed application has an unpublished draft event on its date, hosted by the
 * company profile with the same org.nr. and run by its kontaktperson and medhjelpere. Safe to run
 * again: an existing unpublished event is moved to the application's date if needed, and a
 * published one is left alone.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"companyApplications">} application - The application as read in this transaction.
 * @param {Actor} actor - Who creates the event, for the history.
 *
 * @throws - A Norwegian error if the application is not confirmed, the semester has no default
 * start time, the company has no profile, or a medhjelper is not valid.
 * @returns {Promise<Id<"events">>} - The event.
 */
export async function ensureDraftEvent(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
	actor: Actor,
): Promise<Id<"events">> {
	const { assignedDate } = application;
	if (application.status !== "confirmed" || !assignedDate) {
		throw new ConvexError("Bare bekreftede søknader kan få et arrangement.");
	}
	const { defaultEventStartTime } = await requireSemester(ctx, application.semesterId);
	if (!defaultEventStartTime) {
		throw new ConvexError("Sett starttid for arrangementer i innstillingene først.");
	}
	const eventStart = osloDateTimeToEpoch(assignedDate, defaultEventStartTime);

	const existing = application.eventId ? await ctx.db.get(application.eventId) : null;
	if (existing) {
		if (!existing.published && osloToday(existing.eventStart) !== assignedDate) {
			await ctx.db.patch(existing._id, {
				eventStart,
				registrationOpens: Math.min(existing.registrationOpens, eventStart),
			});
		}
		return existing._id;
	}

	const company = await findCompanyProfile(ctx, application);
	if (!company) {
		throw new ConvexError(
			"Fant ingen bedriftsprofil med samme organisasjonsnummer. Opprett bedriften først.",
		);
	}
	const helperUserIds = application.helperUserIds ?? [];
	await requireValidHelpers(ctx, helperUserIds);

	const eventId = await insertEventWithOrganizers(
		ctx,
		{
			title: `${EVENT_TITLE_PREFIX[application.eventType]} ${company.name}`,
			teaser: PLACEHOLDER,
			description: PLACEHOLDER,
			// Replaced with the real opening time before the event is published.
			eventStart,
			registrationOpens: eventStart,
			participationLimit: application.maxStudents,
			location: PLACEHOLDER,
			food: PLACEHOLDER,
			language: "Norsk",
			ageRestriction: PLACEHOLDER,
			externalEvent: false,
			hostingCompany: company._id,
			published: false,
		},
		[
			...(application.responsibleUserId
				? [{ userId: application.responsibleUserId, role: "hovedansvarlig" as const }]
				: []),
			...helperUserIds.map((userId) => ({ userId, role: "medhjelper" as const })),
		],
	);

	await ctx.db.patch(application._id, { eventId });
	await logApplicationActivity(ctx, application._id, "event_linked", actor);
	return eventId;
}

/**
 * Deletes an application's event, with its organizers and feedback form, when the application
 * gives up its date. Only an unpublished event nobody has signed up for is deleted.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"companyApplications">} application - The application.
 *
 * @throws - A Norwegian error if the event is published or has registrations.
 * @returns {Promise<void>} - Resolves when the event is gone, or if there was none.
 */
export async function deleteDraftEvent(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
): Promise<void> {
	const event = application.eventId ? await ctx.db.get(application.eventId) : null;
	if (!event) return;

	const registration = await ctx.db
		.query("registrations")
		.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
		.first();
	// Only a published event gets feedback, so a campaign means it has been published.
	const campaign = await ctx.db
		.query("feedbackCampaigns")
		.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
		.first();
	if (event.published || registration || campaign) {
		throw new ConvexError(
			`Arrangementet «${event.title}» er publisert eller har påmeldte. Avlys eller endre arrangementet først.`,
		);
	}

	const organizers = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
		.collect();
	await Promise.all(organizers.map((organizer) => ctx.db.delete(organizer._id)));
	if (event.formId) await ctx.db.delete(event.formId);
	await ctx.db.delete(event._id);
}
