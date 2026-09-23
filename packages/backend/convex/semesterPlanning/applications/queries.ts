import { toCompanyProfileOrgNumber } from "@workspace/shared/semester/orgNumber";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { editorRoles, internalRoles, requireRole } from "../../auth/accessRights";
import schema from "../../schema";
import {
	listApplicationsInSemester,
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
			applications.map(async (application) =>
				toPlanRow(
					application,
					application.responsibleUserId ? await ctx.db.get(application.responsibleUserId) : null,
				),
			),
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
 * One application with its offers, its history and the company profile with the same
 * organization number, if one exists and is not linked yet.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 *
 * @throws - An error if the caller is not an editor, or the application does not exist.
 * @returns {object} - The application, offers, history (oldest first) and matching profile.
 */
export const get = query({
	args: { applicationId: v.id("companyApplications") },
	returns: v.object({
		application: schema.doc("companyApplications"),
		offers: v.array(schema.doc("companyApplicationOffers")),
		activity: v.array(schema.doc("companyApplicationActivity")),
		matchingCompanyId: v.union(v.id("companies"), v.null()),
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
		const match = application.companyId
			? null
			: await ctx.db
					.query("companies")
					.withIndex("by_orgNumber", (q) =>
						q.eq("orgNumber", toCompanyProfileOrgNumber(application.orgNumber)),
					)
					.first();

		return { application, offers, activity, matchingCompanyId: match?._id ?? null };
	},
});
