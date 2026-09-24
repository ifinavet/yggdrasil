import { toCompanyProfileOrgNumber } from "@workspace/shared/semester/orgNumber";
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
	logoUrl: v.optional(v.string()),
	eventType: presentationEventType,
	maxStudents: v.number(),
	responsibleUserId: v.optional(v.id("users")),
	responsibleName: v.optional(v.string()),
	helpers: v.array(v.object({ userId: v.id("users"), name: v.string() })),
	eventId: v.optional(v.id("events")),
});

export type PlanRow = Infer<typeof planRowValidator>;

/** The kontaktperson and medhjelpere from Navet for one company. */
export type NavetTeam = { responsible: Doc<"users"> | null; helpers: Doc<"users">[] };

/**
 * Who from Navet runs a company's event. Once the event exists its organizers are the truth, since
 * they can be changed there; before that, the application holds them.
 *
 * @param {QueryCtx} ctx - The Convex query context.
 * @param {Doc<"companyApplications">} application - The application.
 *
 * @returns {Promise<NavetTeam>} - The kontaktperson, if any, and the medhjelpere.
 */
export async function loadNavetTeam(
	ctx: QueryCtx,
	application: Doc<"companyApplications">,
): Promise<NavetTeam> {
	const users = async (ids: Id<"users">[]) =>
		(await Promise.all(ids.map((id) => ctx.db.get(id)))).filter(
			(user): user is Doc<"users"> => user !== null,
		);

	if (application.eventId) {
		const eventId = application.eventId;
		const organizers = await ctx.db
			.query("eventOrganizers")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect();
		const [responsible] = await users(
			organizers.filter((o) => o.role === "hovedansvarlig").map((o) => o.userId),
		);
		const helpers = await users(
			organizers.filter((o) => o.role === "medhjelper").map((o) => o.userId),
		);
		return { responsible: responsible ?? null, helpers };
	}

	return {
		responsible: application.responsibleUserId
			? await ctx.db.get(application.responsibleUserId)
			: null,
		helpers: await users(application.helperUserIds ?? []),
	};
}

const fullName = (user: Doc<"users">) => `${user.firstName} ${user.lastName}`;

/**
 * Builds the plan row for an application. Fields are copied one by one, so a new field on the
 * application never leaks into the plan by accident.
 *
 * @param {Doc<"companyApplications">} application - The application.
 * @param {NavetTeam} team - The kontaktperson and medhjelpere from Navet.
 * @param {string | null} logoUrl - The company's logo from its Bifrost profile, if any.
 *
 * @returns {object} - The plan row.
 */
export function toPlanRow(
	application: Doc<"companyApplications">,
	team: NavetTeam,
	logoUrl: string | null,
): PlanRow {
	const { responsible, helpers } = team;
	return {
		_id: application._id,
		status: application.status,
		...(application.assignedDate ? { assignedDate: application.assignedDate } : {}),
		companyName: application.registry.name,
		...(logoUrl ? { logoUrl } : {}),
		eventType: application.eventType,
		maxStudents: application.maxStudents,
		...(responsible
			? { responsibleUserId: responsible._id, responsibleName: fullName(responsible) }
			: {}),
		helpers: helpers.map((helper) => ({ userId: helper._id, name: fullName(helper) })),
		...(application.eventId ? { eventId: application.eventId } : {}),
	};
}

/**
 * The company profile in Bifrost for an application: the linked one, or else the profile with the
 * same organization number. The same org.nr. means the same company, so no manual linking is needed.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Doc<"companyApplications">} application - The application.
 *
 * @returns {Promise<Id<"companies"> | null>} - The company profile, or null when none exists.
 */
export async function findCompanyProfile(
	ctx: QueryCtx | MutationCtx,
	application: Doc<"companyApplications">,
): Promise<Id<"companies"> | null> {
	if (application.companyId) return application.companyId;
	const company = await ctx.db
		.query("companies")
		.withIndex("by_orgNumber", (q) =>
			q.eq("orgNumber", toCompanyProfileOrgNumber(application.orgNumber)),
		)
		.first();
	return company?._id ?? null;
}
