import { osloToday } from "@workspace/shared/time";
import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { eventsInSemesterRange } from "../semesters/helper";

// Helpers for events that are in a semester plan without an application: ones an editor added by
// hand or imported from the calendar. They register no Convex functions.

/** What every internal member may see of an event in the plan. */
export const planEventRowValidator = v.object({
	_id: v.id("semesterPlanEvents"),
	eventId: v.id("events"),
	/** The Oslo day the event starts, as YYYY-MM-DD. */
	date: v.string(),
	eventStart: v.number(),
	title: v.string(),
	companyName: v.string(),
	logoUrl: v.optional(v.string()),
	published: v.boolean(),
	participationLimit: v.number(),
	responsibleUserId: v.optional(v.id("users")),
	responsibleName: v.optional(v.string()),
	helpers: v.array(v.object({ userId: v.id("users"), name: v.string() })),
});

export type PlanEventRow = Infer<typeof planEventRowValidator>;

/** The Oslo day an event starts on. */
export function eventDate(event: Pick<Doc<"events">, "eventStart">): string {
	return osloToday(event.eventStart);
}

/**
 * Lists the events an editor put in a semester plan.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @returns {Promise<Doc<"semesterPlanEvents">[]>} - The plan events, in no particular order.
 */
export async function listPlanEvents(
	ctx: QueryCtx | MutationCtx,
	semesterId: Id<"semesters">,
): Promise<Doc<"semesterPlanEvents">[]> {
	return ctx.db
		.query("semesterPlanEvents")
		.withIndex("by_semesterId", (q) => q.eq("semesterId", semesterId))
		.collect();
}

/**
 * Finds the plan row an event has, in any semester.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"events">} eventId - The event.
 *
 * @returns {Promise<Doc<"semesterPlanEvents"> | null>} - The plan row, or null.
 */
export async function findPlanEvent(
	ctx: QueryCtx | MutationCtx,
	eventId: Id<"events">,
): Promise<Doc<"semesterPlanEvents"> | null> {
	return ctx.db
		.query("semesterPlanEvents")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.first();
}

/**
 * Finds the application an event was made from, if any. Such an event is already in the plan
 * through its application.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"events">} eventId - The event.
 *
 * @returns {Promise<Doc<"companyApplications"> | null>} - The application, or null.
 */
export async function findApplicationForEvent(
	ctx: QueryCtx | MutationCtx,
	eventId: Id<"events">,
): Promise<Doc<"companyApplications"> | null> {
	return ctx.db
		.query("companyApplications")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.first();
}

/**
 * Whether an event is already in some plan, through an application or a plan row.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"events">} eventId - The event.
 *
 * @returns {Promise<boolean>} - True when the event is in a plan.
 */
export async function isEventInAPlan(
	ctx: QueryCtx | MutationCtx,
	eventId: Id<"events">,
): Promise<boolean> {
	return (
		(await findPlanEvent(ctx, eventId)) !== null ||
		(await findApplicationForEvent(ctx, eventId)) !== null
	);
}

/**
 * Puts every event in the semester's period that is not in a plan yet into this plan. Safe to run
 * again: events already in a plan are skipped. Marks the semester as imported.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"semesters">} semester - The semester, with its first and last date.
 * @param {Id<"users">} [addedBy] - The editor who asked for it; none when it runs automatically.
 *
 * @returns {Promise<{ added: number, skipped: number }>} - How many events were added, and how
 * many were already in a plan.
 */
export async function importCalendarIntoPlan(
	ctx: MutationCtx,
	semester: Doc<"semesters">,
	addedBy?: Id<"users">,
): Promise<{ added: number; skipped: number }> {
	let added = 0;
	let skipped = 0;
	for (const event of await eventsInSemesterRange(ctx, semester)) {
		if (await isEventInAPlan(ctx, event._id)) {
			skipped++;
			continue;
		}
		await ctx.db.insert("semesterPlanEvents", {
			semesterId: semester._id,
			eventId: event._id,
			...(addedBy ? { addedBy } : {}),
		});
		added++;
	}
	await ctx.db.patch(semester._id, { calendarImportedAt: Date.now() });
	return { added, skipped };
}

/**
 * Finds the semester whose period holds a day. Only semesters with a first and last date have a
 * period.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {string} date - The day, as YYYY-MM-DD.
 *
 * @returns {Promise<Doc<"semesters"> | null>} - The semester, or null.
 */
export async function findSemesterOnDate(
	ctx: QueryCtx | MutationCtx,
	date: string,
): Promise<Doc<"semesters"> | null> {
	const year = Number(date.slice(0, 4));
	// A period starts and ends in the semester's year, or runs into the next one.
	for (const candidateYear of [year, year - 1]) {
		const semesters = await ctx.db
			.query("semesters")
			.withIndex("by_year_and_term", (q) => q.eq("year", candidateYear))
			.take(2);
		const match = semesters.find(
			({ firstDate, lastDate }) =>
				firstDate !== undefined && lastDate !== undefined && firstDate <= date && date <= lastDate,
		);
		if (match) return match;
	}
	return null;
}

/**
 * Keeps an event without an application in the plan of the semester it is in. A new event, or
 * one moved into another semester, is put in that plan; an event in a plan moves with its date,
 * and leaves the plan when no semester holds the date any more. An event an editor took out of
 * the plan stays out while it stays in the same semester.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"events">} event - The event, as it is now.
 * @param {number} [previousStart] - When it started before an edit; none for a new event.
 *
 * @returns {Promise<void>} - Resolves when the plan follows the event.
 */
export async function placeEventInPlan(
	ctx: MutationCtx,
	event: Doc<"events">,
	previousStart?: number,
): Promise<void> {
	// An event made from an application is in the plan through it.
	if (await findApplicationForEvent(ctx, event._id)) return;

	const semester = await findSemesterOnDate(ctx, eventDate(event));
	const planEvent = await findPlanEvent(ctx, event._id);
	if (planEvent) {
		if (!semester) await ctx.db.delete(planEvent._id);
		else if (planEvent.semesterId !== semester._id) {
			await ctx.db.patch(planEvent._id, { semesterId: semester._id });
		}
		return;
	}

	if (!semester) return;
	if (previousStart !== undefined) {
		const before = await findSemesterOnDate(ctx, osloToday(previousStart));
		if (before?._id === semester._id) return;
	}
	await ctx.db.insert("semesterPlanEvents", { semesterId: semester._id, eventId: event._id });
}
