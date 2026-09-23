import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { applicationStatus, presentationEventType } from "../schema";

/**
 * Reads an application or throws a Norwegian not-found error.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"companyApplications">} applicationId - The application to read.
 *
 * @throws - An error if the application does not exist.
 * @returns {Promise<Doc<"companyApplications">>} - The application.
 */
export async function requireApplication(
	ctx: QueryCtx | MutationCtx,
	applicationId: Id<"companyApplications">,
): Promise<Doc<"companyApplications">> {
	const application = await ctx.db.get(applicationId);
	if (!application) throw new ConvexError("Søknaden ble ikke funnet.");
	return application;
}

/**
 * Lists every application in a semester.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @returns {Promise<Doc<"companyApplications">[]>} - The applications, in no particular order.
 */
export async function listApplicationsInSemester(
	ctx: QueryCtx | MutationCtx,
	semesterId: Id<"semesters">,
): Promise<Doc<"companyApplications">[]> {
	return ctx.db
		.query("companyApplications")
		.withIndex("by_semesterId_and_status", (q) => q.eq("semesterId", semesterId))
		.collect();
}

/**
 * What internal members who are not editors may see of an application: no contact person, no
 * invoice details, no notes and no brreg details beyond the name.
 */
export const planRowValidator = v.object({
	_id: v.id("companyApplications"),
	status: applicationStatus,
	assignedDate: v.optional(v.string()),
	companyName: v.string(),
	eventType: presentationEventType,
	maxStudents: v.number(),
	responsibleUserId: v.optional(v.id("users")),
	responsibleName: v.optional(v.string()),
	room: v.optional(v.string()),
	roomBooked: v.boolean(),
	foodOrdered: v.boolean(),
	eventId: v.optional(v.id("events")),
});

export type PlanRow = Infer<typeof planRowValidator>;

/**
 * Builds the plan row for an application. Fields are copied one by one, so a new field on the
 * application never leaks into the plan by accident.
 *
 * @param {Doc<"companyApplications">} application - The application.
 * @param {Doc<"users"> | null} responsible - The org-ansvarlig, if any.
 *
 * @returns {object} - The plan row.
 */
export function toPlanRow(
	application: Doc<"companyApplications">,
	responsible: Doc<"users"> | null,
): PlanRow {
	return {
		_id: application._id,
		status: application.status,
		...(application.assignedDate ? { assignedDate: application.assignedDate } : {}),
		companyName: application.registry.name,
		eventType: application.eventType,
		maxStudents: application.maxStudents,
		...(application.responsibleUserId ? { responsibleUserId: application.responsibleUserId } : {}),
		...(responsible ? { responsibleName: `${responsible.firstName} ${responsible.lastName}` } : {}),
		...(application.room ? { room: application.room } : {}),
		roomBooked: application.roomBooked,
		foodOrdered: application.foodOrdered,
		...(application.eventId ? { eventId: application.eventId } : {}),
	};
}
