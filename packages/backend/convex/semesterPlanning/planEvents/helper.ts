import { osloToday } from "@workspace/shared/time";
import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

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
