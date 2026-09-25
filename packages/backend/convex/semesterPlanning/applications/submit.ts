import {
	type ApplicationForm,
	applicationFormSchema,
	SUBMISSION_ID_PATTERN,
} from "@workspace/shared/semester/application";
import { isValidOrgNumber } from "@workspace/shared/semester/orgNumber";
import { osloToday } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { action, internalMutation } from "../../_generated/server";
import { studentDegree } from "../../users/students/schema";
import { logApplicationActivity } from "../applicationLifecycle";
import { rateLimiter } from "../rateLimits";
import { fetchBrregUnit, RegistryUnavailableError } from "../registry/client";
import { BLOCKED_MESSAGES, REGISTRY_UNAVAILABLE_MESSAGE } from "../registry/messages";
import { CONSENT_VERSION, FORM_VERSION } from "../rules";
import {
	applicationBilling,
	applicationContact,
	brregSnapshotAtSubmission,
	foodPurchaser,
	presentationEventType,
	venue,
	wantsToUseEscape,
} from "../schema";
import { acceptsApplications, listSemesterDates } from "../semesters/helper";

/** What the Hugin form sends. The shared Zod schema checks the details. */
const applicationFormArgs = v.object({
	orgNumber: v.string(),
	contact: applicationContact,
	eventType: presentationEventType,
	minStudents: v.number(),
	maxStudents: v.number(),
	description: v.string(),
	availableDates: v.array(v.string()),
	datePreferences: v.optional(v.string()),
	venue,
	wantsToUseEscape,
	foodAndDrinks: v.boolean(),
	foodPurchasedBy: foodPurchaser,
	billing: applicationBilling,
	targetDegrees: v.array(studentDegree),
	targetStudyPrograms: v.array(v.string()),
	additionalInfo: v.optional(v.string()),
	consent: v.boolean(),
});

function parseApplicationForm(form: unknown): ApplicationForm {
	const result = applicationFormSchema.safeParse(form);
	if (!result.success) {
		throw new ConvexError(result.error.issues[0]?.message ?? "Søknaden er ugyldig.");
	}
	return result.data;
}

/**
 * Receives an application from Hugin. Public and unauthenticated, so it trusts nothing from the
 * browser: it validates the form again, looks the company up in brreg again, refuses deleted,
 * bankrupt and liquidated companies, and rate limits per company. It returns null
 * so it never reveals stored data.
 *
 * @param {ApplicationForm} form - The answers.
 * @param {string} submissionId - A one-time id from the form, so a retry saves one application.
 * @param {string} [website] - A hidden honeypot field; bots fill it in, people don't.
 *
 * @throws - A Norwegian error when the form, company, semester or dates are not accepted.
 * @returns {null} - Always null.
 */
export const submit = action({
	args: {
		form: applicationFormArgs,
		submissionId: v.string(),
		website: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, { form, submissionId, website }) => {
		// Answer a filled-in honeypot like a success, so bots learn nothing.
		if (website?.trim()) return null;

		if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
			throw new ConvexError("Skjemaet er utdatert. Last inn siden på nytt.");
		}

		const parsed = parseApplicationForm(form);
		if (!isValidOrgNumber(parsed.orgNumber)) {
			throw new ConvexError("Organisasjonsnummeret er ugyldig.");
		}

		const perCompany = await rateLimiter.limit(ctx, "submitApplication", { key: parsed.orgNumber });
		const overall = await rateLimiter.limit(ctx, "submitApplicationGlobal");
		if (!perCompany.ok || !overall.ok) {
			throw new ConvexError("Det er sendt mange søknader på kort tid. Prøv igjen senere.");
		}

		const now = Date.now();
		let lookup: Awaited<ReturnType<typeof fetchBrregUnit>>;
		try {
			lookup = await fetchBrregUnit(parsed.orgNumber, now);
		} catch (error) {
			if (error instanceof RegistryUnavailableError) {
				throw new ConvexError(REGISTRY_UNAVAILABLE_MESSAGE);
			}
			throw error;
		}
		if (lookup.status === "not_found") {
			throw new ConvexError("Fant ikke bedriften i Enhetsregisteret.");
		}
		if (lookup.blockedReason) {
			throw new ConvexError(BLOCKED_MESSAGES[lookup.blockedReason]);
		}

		await ctx.runMutation(
			internal.semesterPlanning.applications.submit.insertSubmittedApplication,
			{ form: parsed, submissionId, registry: lookup.snapshot },
		);

		return null;
	},
});

/**
 * Saves a checked application. Runs as one transaction: it re-checks the form, the open semester
 * and the dates, skips a submission it has already saved, and records «received» in the history.
 *
 * @throws - A Norwegian error when applications are closed or a date is no longer open.
 * @returns {Id<"companyApplications">} - The new or already saved application.
 */
export const insertSubmittedApplication = internalMutation({
	args: {
		form: applicationFormArgs,
		submissionId: v.string(),
		registry: brregSnapshotAtSubmission,
	},
	returns: v.id("companyApplications"),
	handler: async (ctx, { form, submissionId, registry }) => {
		const already = await ctx.db
			.query("companyApplications")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.first();
		if (already) return already._id;

		const parsed = parseApplicationForm(form);

		const semester = await ctx.db
			.query("semesters")
			.withIndex("by_status", (q) => q.eq("status", "open"))
			.first();
		if (!semester) throw new ConvexError("Søknadene er stengt.");
		if (!acceptsApplications(semester, osloToday(Date.now()))) {
			throw new ConvexError("Søknadsfristen har gått ut.");
		}

		const openDates = new Set(
			(await listSemesterDates(ctx, semester._id))
				.filter((date) => date.closedLabel === undefined)
				.map((date) => date.date),
		);
		if (!parsed.availableDates.every((date) => openDates.has(date))) {
			throw new ConvexError(
				"Én eller flere av datoene er ikke åpne lenger. Last inn siden på nytt.",
			);
		}

		const { consent: _consent, billing, ...answers } = parsed;
		const applicationId = await ctx.db.insert("companyApplications", {
			...answers,
			semesterId: semester._id,
			submissionId,
			formVersion: FORM_VERSION,
			registry,
			billing,
			consent: { version: CONSENT_VERSION, consentedAt: Date.now() },
			status: "applied",
		});

		await logApplicationActivity(ctx, applicationId, "submitted", { type: "company" });

		return applicationId;
	},
});
