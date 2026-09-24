import { v } from "convex/values";
import { query } from "../../_generated/server";
import { editorRoles, internalRoles, requireRole } from "../../auth/accessRights";
import { findCompanyLogoUrl } from "../../companies/helper";
import schema from "../../schema";
import { findLatestOffer } from "../offers/helper";
import {
	findCompanyProfile,
	listApplicationsInSemester,
	loadNavetTeam,
	planRowValidator,
	requireApplication,
	toPlanRow,
} from "./helper";

/**
 * The semester plan for every internal member: dates, companies, status and org-ansvarlig, but
 * no contact person, invoice details or notes. The `returns` validator enforces that.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an internal member.
 * @returns {PlanRow[]} - One row per application.
 */
export const getPlan = query({
	args: { semesterId: v.id("semesters") },
	returns: v.array(planRowValidator),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, internalRoles);

		const applications = await listApplicationsInSemester(ctx, semesterId);
		return Promise.all(
			applications.map(async (application) => {
				const companyId = await findCompanyProfile(ctx, application);
				return toPlanRow(
					application,
					await loadNavetTeam(ctx, application),
					companyId ? await findCompanyLogoUrl(ctx, companyId) : null,
				);
			}),
		);
	},
});

/**
 * Every application in a semester with all details, for editors.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor.
 * @returns {Doc<"companyApplications">[]} - The applications, oldest first.
 */
export const listForSemester = query({
	args: { semesterId: v.id("semesters") },
	returns: v.array(schema.doc("companyApplications")),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, editorRoles);

		const applications = await listApplicationsInSemester(ctx, semesterId);
		return applications.sort((a, b) => a._creationTime - b._creationTime);
	},
});

/**
 * How many applications a semester has, for the count on the Søknader tab.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor.
 * @returns {number} - The number of applications, whatever their status.
 */
export const countForSemester = query({
	args: { semesterId: v.id("semesters") },
	returns: v.number(),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, editorRoles);

		return (await listApplicationsInSemester(ctx, semesterId)).length;
	},
});

/**
 * The dates each company asked for instead of the one it was offered, for the applications in a
 * semester that are waiting for a new date.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor.
 * @returns {{ applicationId: Id<"companyApplications">, dates: string[] }[]} - One entry per application.
 */
export const listRequestedDates = query({
	args: { semesterId: v.id("semesters") },
	returns: v.array(
		v.object({ applicationId: v.id("companyApplications"), dates: v.array(v.string()) }),
	),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, editorRoles);

		const waiting = await ctx.db
			.query("companyApplications")
			.withIndex("by_semesterId_and_status", (q) =>
				q.eq("semesterId", semesterId).eq("status", "new_date_requested"),
			)
			.collect();
		return Promise.all(
			waiting.map(async (application) => {
				const offer = await findLatestOffer(ctx, application._id);
				return {
					applicationId: application._id,
					dates: offer?.status === "new_date_requested" ? (offer.requestedDates ?? []) : [],
				};
			}),
		);
	},
});

/**
 * One application with its offers, its history and its company profile in Bifrost, if any: the
 * linked one, or else the one with the same organization number, with its name and logo.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 *
 * @throws - An error if the caller is not an editor, or the application does not exist.
 * @returns {object} - The application, offers, history (oldest first), profile, its name and logo.
 */
export const get = query({
	args: { applicationId: v.id("companyApplications") },
	returns: v.object({
		application: schema.doc("companyApplications"),
		offers: v.array(schema.doc("companyApplicationOffers")),
		activity: v.array(schema.doc("companyApplicationActivity")),
		companyId: v.union(v.id("companies"), v.null()),
		companyName: v.union(v.string(), v.null()),
		logoUrl: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, { applicationId }) => {
		await requireRole(ctx, editorRoles);

		const application = await requireApplication(ctx, applicationId);
		const offers = await ctx.db
			.query("companyApplicationOffers")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
			.collect();
		const activity = await ctx.db
			.query("companyApplicationActivity")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
			.collect();
		const companyId = await findCompanyProfile(ctx, application);
		const company = companyId ? await ctx.db.get(companyId) : null;
		const logoUrl = companyId ? await findCompanyLogoUrl(ctx, companyId) : null;

		return {
			application,
			offers,
			activity,
			companyId,
			companyName: company?.name ?? null,
			logoUrl,
		};
	},
});
