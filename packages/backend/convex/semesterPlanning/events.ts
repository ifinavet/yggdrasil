import { EVENT_TEXT_PLACEHOLDER } from "@workspace/shared/events/checklist";
import { MAX_HELPERS } from "@workspace/shared/semester/limits";
import { proposeTeams } from "@workspace/shared/semester/team";
import { formatOsloDate, osloDateTimeToEpoch, osloToday } from "@workspace/shared/time";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalRoles, userHasRole } from "../auth/accessRights";
import { insertEventWithOrganizers, setEventOrganizers } from "../events/helper";
import { syncFeedbackCampaign } from "../feedback/delivery/campaigns";
import { cancelInvoice, scheduleInvoice } from "../invoicing/schedule";
import { snapshotOf } from "../products/sales";
import { type Actor, logApplicationActivity, requireAssignableDate } from "./applicationLifecycle";
import {
	applicationTeam,
	findCompanyProfile,
	listEventOrganizers,
	organizersForTeam,
	requireValidHelpers,
	teamOfOrganizers,
} from "./applications/helper";
import { findApplicationForEvent } from "./planEvents/helper";
import { isActiveApplicationStatus } from "./rules";
import { eventsInSemesterRange, requireSemester } from "./semesters/helper";

// Helpers for the events semester planning makes. They register no Convex functions.

const PLACEHOLDER = EVENT_TEXT_PLACEHOLDER;

/** The invoice for an application's presentation, sent after the event. */
const invoiceSource = (application: Doc<"companyApplications">) => ({
	kind: "companyApplication" as const,
	applicationId: application._id,
});

/** Well above how many members Navet has; keeps the reads bounded. */
const READ_LIMIT = 500;

/**
 * Fills in the Navet team for applications that have no event yet, with {@link proposeTeams}:
 * internal members are picked by how many events they organize in the semester's dates. Someone
 * already chosen is kept.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"semesters">} semester - The semester.
 * @param {Doc<"companyApplications">[]} applications - The applications to fill in.
 *
 * @returns {Promise<Doc<"companyApplications">[]>} - The applications, with their teams.
 */
export async function proposeNavetTeams(
	ctx: MutationCtx,
	semester: Doc<"semesters">,
	applications: Doc<"companyApplications">[],
): Promise<Doc<"companyApplications">[]> {
	const rights = await Promise.all(
		internalRoles.map((role) =>
			ctx.db
				.query("accessRights")
				.withIndex("by_role", (q) => q.eq("role", role))
				.take(READ_LIMIT),
		),
	);

	const load = new Map<Id<"users">, number>();
	for (const event of await eventsInSemesterRange(ctx, semester)) {
		const organizers = await ctx.db
			.query("eventOrganizers")
			.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
			.take(READ_LIMIT);
		for (const { userId } of organizers) load.set(userId, (load.get(userId) ?? 0) + 1);
	}

	const needTeam = applications.filter((application) => !application.eventId);
	const teams = proposeTeams(
		needTeam.map(({ _id, responsibleUserId, helperUserIds }) => ({
			id: _id,
			responsibleUserId,
			helperUserIds,
		})),
		// Someone with several internal roles is one candidate.
		[...new Set(rights.flat().map((right) => right.userId))],
		load,
	);
	await Promise.all(teams.map(({ id, ...team }) => ctx.db.patch(id, team)));

	const byId = new Map(teams.map(({ id, ...team }) => [id, team]));
	return applications.map((application) => ({ ...application, ...byId.get(application._id) }));
}

/**
 * Makes sure a confirmed application has an unpublished draft event on its date, hosted by the
 * company profile with the same org.nr. and run by its kontaktperson and medhjelpere. Safe to run
 * again: an existing event is moved to the application's date if needed.
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
		if (osloToday(existing.eventStart) !== assignedDate) {
			await moveApplicationWithEvent(ctx, application, existing, assignedDate, actor);
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

	const product = await ctx.db
		.query("products")
		.withIndex("by_eventType_and_active", (q) =>
			q.eq("eventType", application.eventType).eq("active", true),
		)
		.first();
	const eventId = await insertEventWithOrganizers(
		ctx,
		{
			...(product ? { product: snapshotOf(product) } : {}),
			title: EVENT_TEXT_PLACEHOLDER,
			teaser: PLACEHOLDER,
			description: PLACEHOLDER,
			// Replaced with the real opening time before the event is published.
			eventStart,
			registrationOpens: eventStart,
			participationLimit: application.maxStudents,
			location: PLACEHOLDER,
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
	await scheduleInvoice(ctx, invoiceSource(application), eventStart);
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
	await ctx.db.delete(event._id);
	await cancelInvoice(ctx, invoiceSource(application));
}

/**
 * Records that an application's event is on a new day: the application gets the date, the invoice
 * follows the event, and the history says so. Shared by moving from the plan and from the event
 * editor.
 */
async function recordNewEventDate(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
	eventStart: number,
	actor: Actor,
): Promise<void> {
	const date = osloToday(eventStart);
	await ctx.db.patch(application._id, { assignedDate: date });
	await scheduleInvoice(ctx, invoiceSource(application), eventStart);
	await logApplicationActivity(ctx, application._id, "date_assigned", actor, { date });
}

/**
 * Gives an application with an event a new date by moving the event with it, to the same Oslo
 * time on the new day, as the event editor would. The application stays confirmed: the plan and
 * the event are one booking, so it needs no new offer.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"companyApplications">} application - The application, with its date already checked.
 * @param {Doc<"events">} event - The application's event.
 * @param {string} date - The new day, as YYYY-MM-DD.
 * @param {Actor} actor - Who moves it, for the history.
 *
 * @returns {Promise<void>} - Resolves when both are on the new day.
 */
export async function moveApplicationWithEvent(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
	event: Doc<"events">,
	date: string,
	actor: Actor,
): Promise<void> {
	const eventStart = osloDateTimeToEpoch(date, formatOsloDate(event.eventStart, "HH:mm"));
	await ctx.db.patch(event._id, {
		eventStart,
		registrationOpens: Math.min(event.registrationOpens, eventStart),
	});
	await syncFeedbackCampaign(ctx, event._id);
	await recordNewEventDate(ctx, application, eventStart, actor);
}

/**
 * Sets who from Navet runs an application's event. Before the event exists the application holds
 * the team; after, the event's organizers are changed too, so the plan and the event editor show
 * the same people.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"companyApplications">} application - The application.
 * @param {{ responsibleUserId?: Id<"users"> | null, helperUserIds?: Id<"users">[] }} changes - The
 * kontaktperson (null clears it) and the medhjelpere; a field left out is kept.
 *
 * @throws - A Norwegian error if someone is not an internal member, or is picked twice.
 * @returns {Promise<void>} - Resolves when the team is saved.
 */
export async function setApplicationTeam(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
	changes: { responsibleUserId?: Id<"users"> | null; helperUserIds?: Id<"users">[] },
): Promise<void> {
	const event = application.eventId ? await ctx.db.get(application.eventId) : null;
	const current = await applicationTeam(ctx, application);
	const responsibleUserId =
		changes.responsibleUserId === undefined
			? current.responsibleUserId
			: (changes.responsibleUserId ?? undefined);
	const next = {
		...(responsibleUserId ? { responsibleUserId } : {}),
		helperUserIds: changes.helperUserIds ?? current.helperUserIds,
	};

	if (responsibleUserId && !(await userHasRole(ctx, responsibleUserId, internalRoles))) {
		throw new ConvexError("Kontaktpersonen fra Navet må være et internt medlem.");
	}
	if (changes.helperUserIds !== undefined) {
		await requireValidHelpers(
			ctx,
			changes.helperUserIds,
			Math.max(MAX_HELPERS, current.helperUserIds.length),
		);
	}

	if (event) {
		const organizers = await listEventOrganizers(ctx, event._id);
		await setEventOrganizers(ctx, event._id, organizersForTeam(organizers, current, next));
	}
	await ctx.db.patch(application._id, {
		responsibleUserId: next.responsibleUserId,
		helperUserIds: next.helperUserIds.length ? next.helperUserIds : undefined,
	});
}

/**
 * Brings the application an event was made from in line with the event after the event editor
 * saved it: the day the event starts, with the invoice, and its organizers. Nothing happens for an
 * event without a live application.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"events">} eventId - The event just saved.
 * @param {Actor} actor - Who saved it, for the history.
 *
 * @throws - A Norwegian error if the event was moved to a day the application cannot have.
 * @returns {Promise<void>} - Resolves when the application matches the event.
 */
export async function syncApplicationWithEvent(
	ctx: MutationCtx,
	eventId: Id<"events">,
	actor: Actor,
): Promise<void> {
	const application = await findApplicationForEvent(ctx, eventId);
	const event = await ctx.db.get(eventId);
	if (!application || !event || !isActiveApplicationStatus(application.status)) return;

	const date = osloToday(event.eventStart);
	if (date !== application.assignedDate) {
		try {
			await requireAssignableDate(ctx, application, date);
		} catch (error) {
			if (!(error instanceof ConvexError)) throw error;
			throw new ConvexError(
				`Arrangementet er bedriftspresentasjonen til ${application.registry.name} i semesterplanen, og datoen må passe der. ${error.data}`,
			);
		}
		await recordNewEventDate(ctx, application, event.eventStart, actor);
	}

	const team = teamOfOrganizers(
		await listEventOrganizers(ctx, eventId),
		application.responsibleUserId,
	);
	await ctx.db.patch(application._id, {
		responsibleUserId: team.responsibleUserId,
		helperUserIds: team.helperUserIds.length ? team.helperUserIds : undefined,
	});
}
