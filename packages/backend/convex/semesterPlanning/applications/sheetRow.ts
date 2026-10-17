import { BIFROST_URL } from "@workspace/shared/constants";
import {
	ESCAPE_LABELS,
	EVENT_TYPE_LABELS,
	FOOD_PURCHASER_LABELS,
	semesterName,
	VENUE_LABELS,
} from "@workspace/shared/semester/labels";
import { formatOsloDate } from "@workspace/shared/time";
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../_generated/server";

// A copy of every received application in a Google Sheet, one tab per semester, so Navet has the
// answers outside Bifrost too. The rows are only ever added; Bifrost stays the source of truth.

export const SHEET_HEADER = [
	"Mottatt",
	"Bedrift",
	"Org.nr.",
	"Kontaktperson",
	"E-post",
	"Telefon",
	"Type",
	"Studenter",
	"Beskrivelse",
	"Datoer",
	"Datoønsker",
	"Sted",
	"Mat og drikke",
	"Hvem kjøper",
	"Escape",
	"Faktura e-post",
	"Fakturainfo",
	"EHF",
	"Annet",
	"Bifrost",
] as const;

const yesNo = (value: boolean | undefined) => (value ? "Ja" : "Nei");

/** The application's answers in the order of `SHEET_HEADER`. */
export function applicationSheetRow(application: Doc<"companyApplications">): string[] {
	const { minStudents, maxStudents, billing } = application;
	return [
		formatOsloDate(application.consent.consentedAt, "yyyy-MM-dd HH:mm"),
		application.registry.name,
		application.orgNumber,
		application.contact.name,
		application.contact.email,
		application.contact.phone,
		EVENT_TYPE_LABELS[application.eventType],
		minStudents === maxStudents ? String(maxStudents) : `${minStudents}–${maxStudents}`,
		application.description,
		application.availableDates.join(", "),
		application.datePreferences ?? "",
		VENUE_LABELS[application.venue],
		yesNo(application.foodAndDrinks),
		application.foodAndDrinks ? FOOD_PURCHASER_LABELS[application.foodPurchasedBy] : "",
		ESCAPE_LABELS[application.wantsToUseEscape],
		billing.email ?? "",
		billing.details ?? "",
		yesNo(billing.ehfInvoice),
		application.additionalInfo ?? "",
		`${BIFROST_URL}/semesterplan/soknad/${application._id}`,
	];
}

/** The tab an application goes in, its row, and whether it has been added already. */
export const forSheet = internalQuery({
	args: { applicationId: v.id("companyApplications") },
	returns: v.union(
		v.null(),
		v.object({ title: v.string(), row: v.array(v.string()), added: v.boolean() }),
	),
	handler: async (ctx, { applicationId }) => {
		const application = await ctx.db.get(applicationId);
		const semester = application && (await ctx.db.get(application.semesterId));
		if (!application || !semester) return null;
		return {
			title: semesterName(semester.term, semester.year),
			row: applicationSheetRow(application),
			added: application.sheetRowAddedAt !== undefined,
		};
	},
});

export const markAdded = internalMutation({
	args: { applicationId: v.id("companyApplications") },
	returns: v.null(),
	handler: async (ctx, { applicationId }) => {
		if (await ctx.db.get(applicationId)) {
			await ctx.db.patch(applicationId, { sheetRowAddedAt: Date.now() });
		}
		return null;
	},
});

/** The semester's applications that are not in the sheet yet, oldest first. */
export const missingInSemester = internalQuery({
	args: { semesterId: v.id("semesters") },
	returns: v.array(v.id("companyApplications")),
	handler: async (ctx, { semesterId }) => {
		const applications = await ctx.db
			.query("companyApplications")
			.withIndex("by_semesterId_and_status", (q) => q.eq("semesterId", semesterId))
			.take(1000);
		return applications
			.filter((application) => application.sheetRowAddedAt === undefined)
			.sort((a, b) => a.consent.consentedAt - b.consent.consentedAt)
			.map((application) => application._id);
	},
});
