import { closedDateLabel } from "@workspace/shared/semester/labels";
import { MAX_INTERNAL_NOTES_LENGTH } from "@workspace/shared/semester/limits";
import { isIsoDate } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { type MutationCtx, mutation } from "../../_generated/server";
import { internalRoles, userHasRole } from "../../auth/accessRights";
import {
	type Actor,
	findActiveApplicationOnDate,
	logApplicationActivity,
	requireEditorActor,
	transitionApplicationStatus,
} from "../applicationLifecycle";
import { deleteDraftEvent, ensureDraftEvent } from "../events";
import { supersedePendingOffers } from "../offers/helper";
import { isActiveApplicationStatus } from "../rules";
import { requireSemester } from "../semesters/helper";
import { requireApplication, requireValidHelpers } from "./helper";

function refuseIfApplicationInactive(application: Doc<"companyApplications">): void {
	if (!isActiveApplicationStatus(application.status)) {
		throw new ConvexError("Søknaden er trukket eller avslått.");
	}
}

/**
 * Moves an application to a new date or clears it. The old offer stops working, and an
 * application with an offer goes back to «Søkt» until a new offer is sent. A confirmed
 * application's unpublished event is deleted; a published one stops the move.
 */
async function setAssignedDate(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
	date: string | undefined,
	actor: Actor,
): Promise<void> {
	await supersedePendingOffers(ctx, application._id);

	if (application.status !== "applied") {
		await deleteDraftEvent(ctx, application);
		await transitionApplicationStatus(ctx, application, "applied", actor, {
			patch: { assignedDate: date, eventId: undefined },
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
 * company holds and closed semesters. A confirmed application goes back to «Søkt» and needs a new
 * offer. A date the company did not tick is allowed, and reported back so Bifrost can warn.
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
 * Rejects or withdraws an application and stops its offer link. An unpublished event is deleted;
 * a published one stops the change. Shared by reject and withdraw.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {"rejected" | "withdrawn"} status - The closing status.
 * @param {string} [comment] - Why, for the history.
 *
 * @throws - An error if the caller is not an editor, the status does not allow the change, or the
 * event is published or has registrations.
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

	await deleteDraftEvent(ctx, application);
	await transitionApplicationStatus(ctx, application, status, actor, {
		patch: { eventId: undefined },
		...(comment ? { comment } : {}),
	});
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
 * Reopens a declined, rejected or withdrawn application as «Søkt». Its old date is cleared, since
 * another company may have been given it in the meantime, and so is a link to a deleted event.
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
		if (isActiveApplicationStatus(application.status)) {
			throw new ConvexError("Bare avslåtte og trukne søknader kan gjenåpnes.");
		}
		const eventGone = application.eventId && !(await ctx.db.get(application.eventId));

		await transitionApplicationStatus(ctx, application, "applied", actor, {
			patch: { assignedDate: undefined, ...(eventGone ? { eventId: undefined } : {}) },
		});
		return null;
	},
});

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
 * Creates the unpublished draft event for a confirmed application, on its date and with its
 * kontaktperson and medhjelpere, or moves an existing unpublished one to the date. Navet fills in
 * the details on the event before publishing it.
 *
 * @param {Id<"companyApplications">} applicationId - The confirmed application.
 *
 * @throws - An error if the caller is not an editor, the application is not confirmed, the
 * semester has no start time for events, or the company has no profile in Bifrost.
 * @returns {Id<"events">} - The event.
 */
export const createEvent = mutation({
	args: { applicationId: v.id("companyApplications") },
	returns: v.id("events"),
	handler: async (ctx, { applicationId }) => {
		const actor = await requireEditorActor(ctx);
		return ensureDraftEvent(ctx, await requireApplication(ctx, applicationId), actor);
	},
});
