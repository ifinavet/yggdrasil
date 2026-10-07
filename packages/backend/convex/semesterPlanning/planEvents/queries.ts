import { v } from "convex/values";
import { query } from "../../_generated/server";
import { editorRoles, internalRoles, requireRole } from "../../auth/accessRights";
import { companyWithLogo } from "../../events/queries";
import { fullName, loadEventTeam } from "../applications/helper";
import { eventsInSemesterRange, requireSemester } from "../semesters/helper";
import { eventDate, isEventInAPlan, listPlanEvents, planEventRowValidator } from "./helper";

/**
 * The events an editor put in a semester plan, for every internal member: the event, its company
 * and who from Navet runs it. A row whose event has since been deleted is left out.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an internal member.
 * @returns {PlanEventRow[]} - The plan events, earliest first.
 */
export const listForSemester = query({
	args: { semesterId: v.id("semesters") },
	returns: v.array(planEventRowValidator),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, internalRoles);

		const rows = await Promise.all(
			(await listPlanEvents(ctx, semesterId)).map(async (planEvent) => {
				const event = await ctx.db.get(planEvent.eventId);
				if (!event) return null;
				const [company, { responsible, helpers }] = await Promise.all([
					companyWithLogo(ctx, event.hostingCompany),
					loadEventTeam(ctx, event._id),
				]);
				return {
					_id: planEvent._id,
					eventId: event._id,
					date: eventDate(event),
					eventStart: event.eventStart,
					title: event.title,
					companyName: company.name,
					...(company.logoUrl ? { logoUrl: company.logoUrl } : {}),
					published: event.published,
					participationLimit: event.participationLimit,
					...(responsible
						? { responsibleUserId: responsible._id, responsibleName: fullName(responsible) }
						: {}),
					helpers: helpers.map((helper) => ({ userId: helper._id, name: fullName(helper) })),
				};
			}),
		);
		return rows
			.filter((row) => row !== null)
			.sort((a, b) => a.eventStart - b.eventStart || a.title.localeCompare(b.title, "nb"));
	},
});

/**
 * The events in the semester's period that are not in any plan yet, for the «Legg til
 * arrangement» picker and the calendar import. Empty while the semester has no dates.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor, or the semester does not exist.
 * @returns {object[]} - The events, earliest first.
 */
export const candidates = query({
	args: { semesterId: v.id("semesters") },
	returns: v.array(
		v.object({
			_id: v.id("events"),
			date: v.string(),
			eventStart: v.number(),
			title: v.string(),
			companyName: v.string(),
			published: v.boolean(),
		}),
	),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, editorRoles);

		const semester = await requireSemester(ctx, semesterId);
		const events = await eventsInSemesterRange(ctx, semester);
		const rows = await Promise.all(
			events.map(async (event) => {
				if (await isEventInAPlan(ctx, event._id)) return null;
				const company = await ctx.db.get(event.hostingCompany);
				return {
					_id: event._id,
					date: eventDate(event),
					eventStart: event.eventStart,
					title: event.title,
					companyName: company?.name ?? "Ukjent",
					published: event.published,
				};
			}),
		);
		return rows.filter((row) => row !== null);
	},
});
