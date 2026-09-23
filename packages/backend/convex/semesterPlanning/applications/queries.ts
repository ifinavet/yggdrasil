import { ESCAPE_LABELS, EVENT_TYPE_LABELS, semesterName } from "@workspace/shared/semester/labels";
import { toCompanyProfileOrgNumber } from "@workspace/shared/semester/orgNumber";
import { formatSemesterDay } from "@workspace/shared/semester/time";
import { asciiFilename, toCsv } from "@workspace/shared/utils";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { editorRoles, internalRoles, requireRole } from "../../auth/accessRights";
import schema from "../../schema";
import { findActiveApplicationOnDate } from "../applicationLifecycle";
import { listSemesterDates, requireSemester } from "../semesters/helper";
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

// The columns of the Excel semester plan the export replaces, in the same order. Every row has the
// day columns; a closed or free date fills only the summary, and an assigned date fills the details.
const DAY_COLUMNS = ["Dag", "Dato"] as const;
const SUMMARY_COLUMNS = ["Bekreftet", "Bedrift"] as const;
const DETAIL_COLUMNS = [
	"Sendt tilbud",
	"Org.nummer",
	"Arr.type",
	"Kontaktperson",
	"Epost",
	"Mat",
	"Mat bestilt",
	"Ønsker Escape",
	"Rom/Lokasjon",
	"Rom booket",
	"Org-ansvarlig",
	"Antall plasser",
] as const;
const EXPORT_COLUMNS = [...DAY_COLUMNS, ...SUMMARY_COLUMNS, ...DETAIL_COLUMNS];
const EMPTY_DETAILS = DETAIL_COLUMNS.map(() => "");

const yesNo = (value: boolean) => (value ? "Ja" : "Nei");

/**
 * The semester plan as a CSV file with the same columns as the old Excel sheet: one row per
 * Tuesday and Thursday, with Navet's own dates marked and free dates left empty. The file has a
 * UTF-8 byte order mark so Excel shows æøå correctly.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor, or the semester does not exist.
 * @returns {{ filename: string, csv: string }} - The file name and contents.
 */
export const exportPlanCsv = query({
	args: { semesterId: v.id("semesters") },
	returns: v.object({ filename: v.string(), csv: v.string() }),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, editorRoles);

		const semester = await requireSemester(ctx, semesterId);
		const rows = await Promise.all(
			(await listSemesterDates(ctx, semesterId)).map(async ({ date, closedLabel }) => {
				const day = [formatSemesterDay(date, "weekday"), formatSemesterDay(date, "shortNumeric")];
				if (closedLabel) return [...day, "", `${closedLabel} (internt)`, ...EMPTY_DETAILS];

				const application = await findActiveApplicationOnDate(ctx, semesterId, date);
				if (!application) return [...day, "", "Ledig", ...EMPTY_DETAILS];

				const responsible = application.responsibleUserId
					? await ctx.db.get(application.responsibleUserId)
					: null;
				return [
					...day,
					yesNo(application.status === "confirmed"),
					application.registry.name,
					yesNo(application.status !== "applied"),
					application.orgNumber,
					EVENT_TYPE_LABELS[application.eventType],
					application.contact.name,
					application.contact.email,
					yesNo(application.foodAndDrinks),
					yesNo(application.foodOrdered),
					ESCAPE_LABELS[application.wantsToUseEscape],
					application.room ?? "",
					yesNo(application.roomBooked),
					responsible ? `${responsible.firstName} ${responsible.lastName}` : "",
					String(application.maxStudents),
				];
			}),
		);

		return {
			filename: `semesterplan-${asciiFilename(semesterName(semester.term, semester.year))}.csv`,
			csv: toCsv([EXPORT_COLUMNS, ...rows]),
		};
	},
});
