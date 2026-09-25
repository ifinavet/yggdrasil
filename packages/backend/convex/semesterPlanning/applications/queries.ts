import { v } from "convex/values";
import { query } from "../../_generated/server";
import { editorRoles, internalRoles, requireRole } from "../../auth/accessRights";
import { findCompanyLogoUrl } from "../../companies/helper";
import schema from "../../schema";
import { findLatestOffer } from "../offers/helper";
import { isActiveApplicationStatus } from "../rules";
import { offerStatus } from "../schema";
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
 * no contact person, invoice details or notes. The `returns` validator enforces that. Declined,
 * rejected and withdrawn applications are left out, so each date shows one company.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an internal member.
 * @returns {PlanRow[]} - One row per live application.
 */
export const getPlan = query({
	args: { semesterId: v.id("semesters") },
	returns: v.array(planRowValidator),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, internalRoles);

		const applications = await listApplicationsInSemester(ctx, semesterId);
		return Promise.all(
			applications
				.filter((application) => isActiveApplicationStatus(application.status))
				.map(async (application) => {
					const company = await findCompanyProfile(ctx, application);
					return toPlanRow(
						application,
						await loadNavetTeam(ctx, application),
						company ? await findCompanyLogoUrl(ctx, company._id) : null,
					);
				}),
		);
	},
});

/**
 * Every application in a semester with all details, for editors, with what needs handling: the
 * state of its latest offer, the dates the company asked for, and the company's latest comment.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor.
 * @returns {object[]} - The applications, oldest first, with `latestOffer` and `companyComment`.
 */
export const listForSemester = query({
	args: { semesterId: v.id("semesters") },
	returns: v.array(
		v.object({
			...schema.doc("companyApplications").fields,
			latestOffer: v.union(
				v.null(),
				v.object({
					status: offerStatus,
					respondedAt: v.optional(v.number()),
					requestedDates: v.optional(v.array(v.string())),
				}),
			),
			companyComment: v.union(v.string(), v.null()),
		}),
	),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, editorRoles);

		const applications = await listApplicationsInSemester(ctx, semesterId);
		const rows = await Promise.all(
			applications.map(async (application) => {
				const offer = await findLatestOffer(ctx, application._id);
				let companyComment: string | null = null;
				for await (const row of ctx.db
					.query("companyApplicationActivity")
					.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
					.order("desc")) {
					if (row.actor === "company" && row.comment) {
						companyComment = row.comment;
						break;
					}
				}
				return {
					...application,
					latestOffer: offer
						? {
								status: offer.status,
								...(offer.respondedAt ? { respondedAt: offer.respondedAt } : {}),
								...(offer.requestedDates ? { requestedDates: offer.requestedDates } : {}),
							}
						: null,
					companyComment,
				};
			}),
		);
		return rows.sort((a, b) => a._creationTime - b._creationTime);
	},
});

/**
 * One application with its offers, its history and the company profile in Bifrost with the same
 * organization number, if any, with its name and logo.
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
		const company = await findCompanyProfile(ctx, application);

		return {
			application,
			offers,
			activity,
			companyId: company?._id ?? null,
			companyName: company?.name ?? null,
			logoUrl: company ? await findCompanyLogoUrl(ctx, company._id) : null,
		};
	},
});
