import { applicationContactSchema } from "@workspace/shared/semester/application";
import { closedDateLabel } from "@workspace/shared/semester/labels";
import { MAX_HELPERS, MAX_INTERNAL_NOTES_LENGTH } from "@workspace/shared/semester/limits";
import { toCompanyProfileOrgNumber } from "@workspace/shared/semester/orgNumber";
import { formatSemesterDay, isIsoDate, osloToday } from "@workspace/shared/semester/time";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { type MutationCtx, mutation } from "../../_generated/server";
import { internalRoles, userHasRole } from "../../auth/accessRights";
import { insertEventWithOrganizers } from "../../events/helper";
import { newEventArgs } from "../../events/schema";
import {
	type Actor,
	findActiveApplicationOnDate,
	logApplicationActivity,
	requireEditorActor,
	transitionApplicationStatus,
} from "../applicationLifecycle";
import { supersedePendingOffers } from "../offers/helper";
import { isActiveApplicationStatus } from "../rules";
import { applicationContact } from "../schema";
import { requireSemester } from "../semesters/helper";
import { requireApplication } from "./helper";

const CONFIRMED_LOCKED_MESSAGE =
	"Bekreftede søknader kan ikke flyttes. Trekk og gjenåpne søknaden først.";

function refuseIfApplicationInactive(application: Doc<"companyApplications">): void {
	if (!isActiveApplicationStatus(application.status)) {
		throw new ConvexError("Søknaden er trukket eller avslått.");
	}
}

/**
 * Moves an application to a new date or clears it. The old offer stops working, and an
 * application with an open offer goes back to «Søkt» until a new offer is sent.
 */
async function setAssignedDate(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
	date: string | undefined,
	actor: Actor,
): Promise<void> {
	await supersedePendingOffers(ctx, application._id);

	const hasOpenOffer =
		application.status === "offer_sent" || application.status === "new_date_requested";
	if (hasOpenOffer) {
		await transitionApplicationStatus(ctx, application, "applied", actor, {
			patch: { assignedDate: date },
		});
	} else {
		await ctx.db.patch(application._id, { assignedDate: date });
	}

	// A cleared date is logged with the date it had.
	const loggedDate = date ?? application.assignedDate;
	await logApplicationActivity(
		ctx,
		application._id,
		date ? "date_assigned" : "date_cleared",
		actor,
		loggedDate ? { date: loggedDate } : {},
	);
}

/**
 * Gives an application a date, or clears it with null. Refuses closed dates, dates another
 * company holds, confirmed applications and closed semesters. A date the company did not tick is
 * allowed, and reported back so Bifrost can warn.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {string | null} date - The day as YYYY-MM-DD, or null to clear it.
 *
 * @throws - An error if the caller is not an editor, or the date cannot be given.
 * @returns {{ outsideAvailable: boolean }} - Whether the company did not tick the date.
 */
export const assignDate = mutation({
	args: { applicationId: v.id("companyApplications"), date: v.union(v.string(), v.null()) },
	returns: v.object({ outsideAvailable: v.boolean() }),
	handler: async (ctx, { applicationId, date }) => {
		const actor = await requireEditorActor(ctx);
		const application = await requireApplication(ctx, applicationId);
		refuseIfApplicationInactive(application);
		if (application.status === "confirmed") throw new ConvexError(CONFIRMED_LOCKED_MESSAGE);

		const semester = await requireSemester(ctx, application.semesterId);
		if (semester.status === "closed") throw new ConvexError("Semesteret er stengt.");

		if (date === null) {
			if (application.assignedDate) await setAssignedDate(ctx, application, undefined, actor);
			return { outsideAvailable: false };
		}

		if (!isIsoDate(date)) throw new ConvexError("Ugyldig dato.");
		const semesterDate = await ctx.db
			.query("semesterDates")
			.withIndex("by_semesterId_and_date", (q) =>
				q.eq("semesterId", application.semesterId).eq("date", date),
			)
			.first();
		if (!semesterDate) throw new ConvexError("Datoen finnes ikke i semesteret.");
		if (semesterDate.closedLabel !== undefined) {
			throw new ConvexError(`Datoen er stengt: ${closedDateLabel(semesterDate.closedLabel)}.`);
		}

		const holder = await findActiveApplicationOnDate(
			ctx,
			application.semesterId,
			date,
			applicationId,
		);
		if (holder) throw new ConvexError(`Datoen er allerede tildelt ${holder.registry.name}.`);

		if (application.assignedDate !== date) await setAssignedDate(ctx, application, date, actor);

		return { outsideAvailable: !application.availableDates.includes(date) };
	},
});

const closeApplicationArgs = {
	applicationId: v.id("companyApplications"),
	comment: v.optional(v.string()),
};

/**
 * Rejects or withdraws an application and stops its offer link. Shared by reject and withdraw.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {"rejected" | "withdrawn"} status - The closing status.
 * @param {string} [comment] - Why, for the history.
 *
 * @throws - An error if the caller is not an editor, or the status does not allow the change.
 * @returns {Promise<null>} - Resolves with null when the application is closed.
 */
async function closeApplication(
	ctx: MutationCtx,
	applicationId: Id<"companyApplications">,
	status: "rejected" | "withdrawn",
	comment: string | undefined,
): Promise<null> {
	const actor = await requireEditorActor(ctx);
	const application = await requireApplication(ctx, applicationId);

	await transitionApplicationStatus(ctx, application, status, actor, comment ? { comment } : {});
	await supersedePendingOffers(ctx, applicationId);
	return null;
}

/**
 * Rejects an application. Its offer link stops working.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {string} [comment] - Why, for the history.
 *
 * @throws - An error if the caller is not an editor, or the status does not allow rejecting.
 * @returns {null} - Returns null when the application is rejected.
 */
export const reject = mutation({
	args: closeApplicationArgs,
	returns: v.null(),
	handler: (ctx, { applicationId, comment }) =>
		closeApplication(ctx, applicationId, "rejected", comment),
});

/**
 * Marks an application as withdrawn. Its date is free again and its offer link stops working;
 * the date stays on the application for the history.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {string} [comment] - Why, for the history.
 *
 * @throws - An error if the caller is not an editor, or the application is already closed.
 * @returns {null} - Returns null when the application is withdrawn.
 */
export const withdraw = mutation({
	args: closeApplicationArgs,
	returns: v.null(),
	handler: (ctx, { applicationId, comment }) =>
		closeApplication(ctx, applicationId, "withdrawn", comment),
});

/**
 * Reopens a rejected or withdrawn application as «Søkt». Its old date is cleared, since another
 * company may have been given it in the meantime.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 *
 * @throws - An error if the caller is not an editor, or the application is still live.
 * @returns {null} - Returns null when the application is reopened.
 */
export const reopen = mutation({
	args: { applicationId: v.id("companyApplications") },
	returns: v.null(),
	handler: async (ctx, { applicationId }) => {
		const actor = await requireEditorActor(ctx);
		const application = await requireApplication(ctx, applicationId);

		await transitionApplicationStatus(ctx, application, "applied", actor, {
			patch: { assignedDate: undefined },
		});
		return null;
	},
});

/** Refuses medhjelpere picked twice, too many of them, or anyone who is not an internal member. */
async function requireValidHelpers(ctx: MutationCtx, helperUserIds: Id<"users">[]): Promise<void> {
	if (new Set(helperUserIds).size !== helperUserIds.length) {
		throw new ConvexError("Samme person er valgt som medhjelper to ganger.");
	}
	if (helperUserIds.length > MAX_HELPERS) {
		throw new ConvexError(`Et arrangement kan ha høyst ${MAX_HELPERS} medhjelpere.`);
	}
	for (const userId of helperUserIds) {
		if (!(await userHasRole(ctx, userId, internalRoles))) {
			throw new ConvexError("Medhjelperne må være interne medlemmer.");
		}
	}
}

/**
 * Updates who from Navet runs the event, the kontaktperson and medhjelpere, and the internal
 * notes. Once the event exists, its organizers are the team, so the team is changed on the event
 * instead. These changes are not written to the history.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {Id<"users"> | null} [responsibleUserId] - The kontaktperson from Navet, or null to clear.
 * @param {Id<"users">[]} [helperUserIds] - Up to MAX_HELPERS medhjelpere; an empty list clears them.
 * @param {string} [internalNotes] - Notes for editors; an empty string clears them.
 *
 * @throws - An error if the caller is not an editor, the team is changed after the event exists,
 * or a team member is not an internal member or is picked twice.
 * @returns {null} - Returns null when the fields are saved.
 */
export const updatePlanningDetails = mutation({
	args: {
		applicationId: v.id("companyApplications"),
		responsibleUserId: v.optional(v.union(v.id("users"), v.null())),
		helperUserIds: v.optional(v.array(v.id("users"))),
		internalNotes: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, { applicationId, responsibleUserId, helperUserIds, internalNotes }) => {
		await requireEditorActor(ctx);
		const application = await requireApplication(ctx, applicationId);

		const changesTeam = responsibleUserId !== undefined || helperUserIds !== undefined;
		if (changesTeam && application.eventId) {
			throw new ConvexError(
				"Arrangementet er opprettet. Endre kontaktperson og medhjelpere på arrangementet.",
			);
		}

		if (responsibleUserId && !(await userHasRole(ctx, responsibleUserId, internalRoles))) {
			throw new ConvexError("Kontaktpersonen fra Navet må være et internt medlem.");
		}
		if (helperUserIds !== undefined) await requireValidHelpers(ctx, helperUserIds);
		if (internalNotes !== undefined && internalNotes.length > MAX_INTERNAL_NOTES_LENGTH) {
			throw new ConvexError(`Notatene kan ha høyst ${MAX_INTERNAL_NOTES_LENGTH} tegn.`);
		}

		const cleared = (value: string) => value.trim() || undefined;
		await ctx.db.patch(applicationId, {
			...(responsibleUserId !== undefined
				? { responsibleUserId: responsibleUserId ?? undefined }
				: {}),
			...(helperUserIds !== undefined
				? { helperUserIds: helperUserIds.length ? helperUserIds : undefined }
				: {}),
			...(internalNotes !== undefined ? { internalNotes: cleared(internalNotes) } : {}),
		});
		return null;
	},
});

/**
 * Replaces the contact person, e.g. when the old one has left the company. Offers go to the new
 * address. The change is written to the history.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {{ name: string, email: string, phone: string }} contact - The new contact person.
 *
 * @throws - An error if the caller is not an editor, or the contact details are invalid.
 * @returns {null} - Returns null when the contact is saved.
 */
export const updateContact = mutation({
	args: { applicationId: v.id("companyApplications"), contact: applicationContact },
	returns: v.null(),
	handler: async (ctx, { applicationId, contact }) => {
		const actor = await requireEditorActor(ctx);
		const application = await requireApplication(ctx, applicationId);

		const parsed = applicationContactSchema.safeParse(contact);
		if (!parsed.success) {
			throw new ConvexError(parsed.error.issues[0]?.message ?? "Ugyldig kontaktperson.");
		}

		await ctx.db.patch(applicationId, { contact: parsed.data });
		await logApplicationActivity(ctx, applicationId, "contact_changed", actor, {
			comment: `${application.contact.name} → ${parsed.data.name}`,
		});
		return null;
	},
});

/**
 * Creates the event for a confirmed application from Bifrost's own event form, which the
 * application fills in: the date, company, seats and the kontaktperson and medhjelpere as
 * organizers. The event must be on the application's date, and hosted by the company profile
 * with the application's org.nr., which the application is then linked to. The room and food
 * tasks follow from the company's answers, and the event is remembered on the application.
 *
 * @param {Id<"companyApplications">} applicationId - The confirmed application.
 *
 * @throws - An error if the caller is not an editor, the application is not confirmed, already
 * has an event, the event is on another day, or the hosting company has another org.nr.
 * @returns {Id<"events">} - The new event.
 */
export const createEvent = mutation({
	args: { applicationId: v.id("companyApplications"), ...newEventArgs },
	returns: v.id("events"),
	handler: async (ctx, { applicationId, organizers, ...details }) => {
		const actor = await requireEditorActor(ctx);
		const application = await requireApplication(ctx, applicationId);

		if (application.status !== "confirmed" || !application.assignedDate) {
			throw new ConvexError("Bare bekreftede søknader kan få et arrangement.");
		}
		if (application.eventId && (await ctx.db.get(application.eventId))) {
			throw new ConvexError("Søknaden har allerede et arrangement.");
		}
		if (osloToday(details.eventStart) !== application.assignedDate) {
			throw new ConvexError(
				`Arrangementet må være ${formatSemesterDay(application.assignedDate, "long")}, datoen bedriften har fått.`,
			);
		}
		const company = await ctx.db.get(details.hostingCompany);
		if (company?.orgNumber !== toCompanyProfileOrgNumber(application.orgNumber)) {
			throw new ConvexError("Bedriften må ha samme organisasjonsnummer som søknaden.");
		}

		const eventId = await insertEventWithOrganizers(
			ctx,
			{ ...details, externalEvent: false },
			organizers,
		);

		await ctx.db.patch(applicationId, { eventId, companyId: company._id });
		await logApplicationActivity(ctx, applicationId, "event_linked", actor);
		return eventId;
	},
});
