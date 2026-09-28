import { ConvexError, v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { mutation } from "../../_generated/server";
import { editorRoles, requireRole } from "../../auth/accessRights";
import { requireEditorActor } from "../applicationLifecycle";
import {
	eventsInSemesterRange,
	refuseIfSemesterClosed,
	requireSemester,
} from "../semesters/helper";
import { eventDate, isEventInAPlan } from "./helper";

function requireRange(
	semester: Doc<"semesters">,
): asserts semester is Doc<"semesters"> & { firstDate: string; lastDate: string } {
	if (!semester.firstDate || !semester.lastDate) {
		throw new ConvexError("Sett første og siste dato under Innstillinger først.");
	}
}

/**
 * Puts an existing event in the semester plan. The event must start in the semester's period and
 * not be in a plan already, through an application or by hand. A date that already has an event
 * or an application is allowed: the plan shows both, and overriding it is the point of adding by
 * hand.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 * @param {Id<"events">} eventId - The event to add.
 *
 * @throws - An error if the caller is not an editor, the semester is closed or has no dates, or the
 * event is missing, outside the period or already in a plan.
 * @returns {null} - Returns null when the event is in the plan.
 */
export const addEvent = mutation({
	args: { semesterId: v.id("semesters"), eventId: v.id("events") },
	returns: v.null(),
	handler: async (ctx, { semesterId, eventId }) => {
		const actor = await requireEditorActor(ctx);

		const semester = await requireSemester(ctx, semesterId);
		refuseIfSemesterClosed(semester);
		requireRange(semester);

		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Arrangementet ble ikke funnet.");
		const date = eventDate(event);
		if (date < semester.firstDate || date > semester.lastDate) {
			throw new ConvexError("Arrangementet er ikke i semesterets periode.");
		}
		if (await isEventInAPlan(ctx, eventId)) {
			throw new ConvexError("Arrangementet er allerede i en semesterplan.");
		}

		await ctx.db.insert("semesterPlanEvents", { semesterId, eventId, addedBy: actor.userId });
		return null;
	},
});

/**
 * Takes an event out of the plan. The event itself is kept.
 *
 * @param {Id<"semesterPlanEvents">} planEventId - The plan row to remove.
 *
 * @throws - An error if the caller is not an editor, the row is missing or the semester is closed.
 * @returns {null} - Returns null when the event is out of the plan.
 */
export const removeEvent = mutation({
	args: { planEventId: v.id("semesterPlanEvents") },
	returns: v.null(),
	handler: async (ctx, { planEventId }) => {
		await requireRole(ctx, editorRoles);

		const planEvent = await ctx.db.get(planEventId);
		if (!planEvent) throw new ConvexError("Arrangementet er ikke i planen.");
		refuseIfSemesterClosed(await requireSemester(ctx, planEvent.semesterId));

		await ctx.db.delete(planEventId);
		return null;
	},
});

/**
 * Puts every event in the semester's period that is not in a plan yet into this plan, so events
 * made before semester planning, or outside it, show up. Safe to run again: events already in a
 * plan are skipped.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor, or the semester is closed or has no dates.
 * @returns {{ added: number, skipped: number }} - How many events were added, and how many were
 * already in a plan.
 */
export const importFromCalendar = mutation({
	args: { semesterId: v.id("semesters") },
	returns: v.object({ added: v.number(), skipped: v.number() }),
	handler: async (ctx, { semesterId }) => {
		const actor = await requireEditorActor(ctx);

		const semester = await requireSemester(ctx, semesterId);
		refuseIfSemesterClosed(semester);
		requireRange(semester);

		let added = 0;
		let skipped = 0;
		for (const event of await eventsInSemesterRange(ctx, semester)) {
			if (await isEventInAPlan(ctx, event._id)) {
				skipped++;
				continue;
			}
			await ctx.db.insert("semesterPlanEvents", {
				semesterId,
				eventId: event._id,
				addedBy: actor.userId,
			});
			added++;
		}

		return { added, skipped };
	},
});
