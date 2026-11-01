import { MAX_HELPERS } from "@workspace/shared/semester/limits";
import { toCompanyProfileOrgNumber } from "@workspace/shared/semester/orgNumber";
import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalRoles, userHasRole } from "../../auth/accessRights";
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
	return await ctx.db
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

async function loadUsers(ctx: QueryCtx, ids: Id<"users">[]): Promise<Doc<"users">[]> {
	return (await Promise.all(ids.map((id) => ctx.db.get(id)))).filter(
		(user): user is Doc<"users"> => user !== null,
	);
}

/** A team by user id: the kontaktperson, if any, and the medhjelpere. */
export type TeamIds = { responsibleUserId?: Id<"users">; helperUserIds: Id<"users">[] };

type Organizer = Pick<Doc<"eventOrganizers">, "userId" | "role">;

/**
 * The team an event's organizers make: a hovedansvarlig as kontaktperson, `preferred` when it is
 * one of them, and every medhjelper.
 *
 * @param {Organizer[]} organizers - The event's organizers.
 * @param {Id<"users">} [preferred] - The kontaktperson the application has, kept while still a hovedansvarlig.
 *
 * @returns {TeamIds} - The kontaktperson and the medhjelpere.
 */
export function teamOfOrganizers(
	organizers: readonly Organizer[],
	preferred?: Id<"users">,
): TeamIds {
	const leads = organizers.filter((o) => o.role === "hovedansvarlig").map((o) => o.userId);
	const responsibleUserId = preferred && leads.includes(preferred) ? preferred : leads[0];
	return {
		...(responsibleUserId ? { responsibleUserId } : {}),
		helperUserIds: organizers.filter((o) => o.role === "medhjelper").map((o) => o.userId),
	};
}

/**
 * The organizers an event gets when its team is changed from the semester plan: the kontaktperson
 * as hovedansvarlig and the medhjelpere. Other hovedansvarlige set on the event stay.
 *
 * @param {Organizer[]} organizers - The event's organizers now.
 * @param {TeamIds} current - The team they make now.
 * @param {TeamIds} next - The team the event should have.
 *
 * @returns {Organizer[]} - The organizers to set.
 */
export function organizersForTeam(
	organizers: readonly Organizer[],
	current: TeamIds,
	next: TeamIds,
): Organizer[] {
	const team = new Set([next.responsibleUserId, ...next.helperUserIds]);
	const otherLeads = organizers.filter(
		(o) =>
			o.role === "hovedansvarlig" && o.userId !== current.responsibleUserId && !team.has(o.userId),
	);
	return [
		...(next.responsibleUserId
			? [{ userId: next.responsibleUserId, role: "hovedansvarlig" as const }]
			: []),
		...otherLeads.map(({ userId }) => ({ userId, role: "hovedansvarlig" as const })),
		...next.helperUserIds.map((userId) => ({ userId, role: "medhjelper" as const })),
	];
}

/**
 * An event's organizers.
 *
 * @param {QueryCtx} ctx - The Convex query context.
 * @param {Id<"events">} eventId - The event.
 *
 * @returns {Promise<Doc<"eventOrganizers">[]>} - The organizers, in the order they were added.
 */
export async function listEventOrganizers(
	ctx: QueryCtx,
	eventId: Id<"events">,
): Promise<Doc<"eventOrganizers">[]> {
	return ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.collect();
}

async function loadTeam(ctx: QueryCtx, team: TeamIds): Promise<NavetTeam> {
	return {
		responsible: team.responsibleUserId ? await ctx.db.get(team.responsibleUserId) : null,
		helpers: await loadUsers(ctx, team.helperUserIds),
	};
}

/**
 * Who from Navet runs an event, from its organizers.
 *
 * @param {QueryCtx} ctx - The Convex query context.
 * @param {Id<"events">} eventId - The event.
 * @param {Id<"users">} [preferred] - The hovedansvarlig to show as kontaktperson, if there are several.
 *
 * @returns {Promise<NavetTeam>} - The hovedansvarlig, if any, and the medhjelpere.
 */
export async function loadEventTeam(
	ctx: QueryCtx,
	eventId: Id<"events">,
	preferred?: Id<"users">,
): Promise<NavetTeam> {
	return loadTeam(ctx, teamOfOrganizers(await listEventOrganizers(ctx, eventId), preferred));
}

/**
 * The team by user id for an application. Once the event exists its organizers are the team, so
 * a change in the event editor or the plan shows in both; before that, the application holds it.
 *
 * @param {QueryCtx} ctx - The Convex query context.
 * @param {Doc<"companyApplications">} application - The application.
 *
 * @returns {Promise<TeamIds>} - The kontaktperson, if any, and the medhjelpere.
 */
export async function applicationTeam(
	ctx: QueryCtx,
	application: Doc<"companyApplications">,
): Promise<TeamIds> {
	if (application.eventId && (await ctx.db.get(application.eventId))) {
		return teamOfOrganizers(
			await listEventOrganizers(ctx, application.eventId),
			application.responsibleUserId,
		);
	}
	return {
		...(application.responsibleUserId ? { responsibleUserId: application.responsibleUserId } : {}),
		helperUserIds: application.helperUserIds ?? [],
	};
}

/**
 * Who from Navet runs a company's event, as users. See {@link applicationTeam}.
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
	return loadTeam(ctx, await applicationTeam(ctx, application));
}

/** «Kari Nordmann» */
export const fullName = (user: Doc<"users">) => `${user.firstName} ${user.lastName}`;

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
 * The company profile in Bifrost with the application's organization number, if any.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Doc<"companyApplications">} application - The application.
 *
 * @returns {Promise<Doc<"companies"> | null>} - The company profile, or null when none exists.
 */
export async function findCompanyProfile(
	ctx: QueryCtx | MutationCtx,
	application: Doc<"companyApplications">,
): Promise<Doc<"companies"> | null> {
	return await ctx.db
		.query("companies")
		.withIndex("by_orgNumber", (q) =>
			q.eq("orgNumber", toCompanyProfileOrgNumber(application.orgNumber)),
		)
		.first();
}

/**
 * Refuses medhjelpere picked twice, too many of them, or anyone who is not an internal member.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"users">[]} helperUserIds - The medhjelpere.
 * @param {number} [max] - How many are allowed. An event can have more medhjelpere than the plan
 * picks, so a team already that big may stay that big.
 *
 * @throws - A Norwegian error if the medhjelpere are not valid.
 * @returns {Promise<void>} - Resolves when they are valid.
 */
export async function requireValidHelpers(
	ctx: QueryCtx | MutationCtx,
	helperUserIds: Id<"users">[],
	max: number = MAX_HELPERS,
): Promise<void> {
	if (new Set(helperUserIds).size !== helperUserIds.length) {
		throw new ConvexError("Samme person er valgt som medhjelper to ganger.");
	}
	if (helperUserIds.length > max) {
		throw new ConvexError(`Et arrangement kan ha høyst ${max} medhjelpere.`);
	}
	for (const userId of helperUserIds) {
		if (!(await userHasRole(ctx, userId, internalRoles))) {
			throw new ConvexError("Medhjelperne må være interne medlemmer.");
		}
	}
}
