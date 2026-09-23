import {
	type ApplicationForm,
	applicationFormSchema,
	SUBMISSION_ID_PATTERN,
} from "@workspace/shared/semester/application";
import {
	ESCAPE_LABELS,
	EVENT_TYPE_LABELS,
	semesterName,
	VENUE_LABELS,
} from "@workspace/shared/semester/labels";
import { isValidOrgNumber } from "@workspace/shared/semester/orgNumber";
import { formatSemesterDay } from "@workspace/shared/semester/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { action, internalMutation } from "../../_generated/server";
import { studentDegree } from "../../users/students/schema";
import { companyRecipients, logApplicationActivity } from "../applicationLifecycle";
import { rateLimiter } from "../rateLimits";
import {
	fetchBrregUnit,
	lookupPeppolParticipant,
	RegistryUnavailableError,
} from "../registry/client";
import { BLOCKED_MESSAGES, REGISTRY_UNAVAILABLE_MESSAGE } from "../registry/messages";
import { CONSENT_VERSION, FORM_VERSION } from "../rules";
import {
	applicationContact,
	brregSnapshotAtSubmission,
	foodPurchaser,
	peppolLookup,
	presentationEventType,
	venue,
	wantsToUseEscape,
} from "../schema";
import { listSemesterDates } from "../semesters/helper";

/** What the Hugin form sends. The shared Zod schema checks the details. */
export const applicationFormArgs = v.object({
	orgNumber: v.string(),
	contact: applicationContact,
	filledInByEmail: v.optional(v.string()),
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
	billing: v.object({
		email: v.string(),
		ehf: v.boolean(),
		reference: v.optional(v.string()),
	}),
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
 * bankrupt and liquidated companies, checks Peppol and rate limits per company. It returns null
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

		const peppol = await lookupPeppolParticipant(parsed.orgNumber);

		await ctx.runMutation(
			internal.semesterPlanning.applications.submit.insertSubmittedApplication,
			{
				form: parsed,
				submissionId,
				registry: lookup.snapshot,
				peppolLookup: peppol,
				peppolCheckedAt: Date.now(),
			},
		);

		return null;
	},
});

/**
 * Saves a checked application. Runs as one transaction: it re-checks the form, the open semester
 * and the dates, skips a submission it has already saved, records «received» in the history and
 * queues the receipt email.
 *
 * @throws - A Norwegian error when applications are closed or a date is no longer open.
 * @returns {Id<"companyApplications">} - The new or already saved application.
 */
export const insertSubmittedApplication = internalMutation({
	args: {
		form: applicationFormArgs,
		submissionId: v.string(),
		registry: brregSnapshotAtSubmission,
		peppolLookup,
		peppolCheckedAt: v.number(),
	},
	returns: v.id("companyApplications"),
	handler: async (ctx, { form, submissionId, registry, peppolLookup, peppolCheckedAt }) => {
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
			billing: { ...billing, peppolLookup, peppolCheckedAt },
			consent: { version: CONSENT_VERSION, consentedAt: Date.now() },
			status: "applied",
			roomBooked: false,
			foodOrdered: false,
		});

		await logApplicationActivity(ctx, applicationId, "submitted", { type: "company" });

		await ctx.scheduler.runAfter(0, internal.emails.sendApplicationReceiptEmail, {
			to: companyRecipients(parsed),
			companyName: registry.name,
			semesterLabel: semesterName(semester.term, semester.year, { inSentence: true }),
			rows: receiptRows(parsed, registry.name),
		});

		return applicationId;
	},
});

function receiptRows(
	form: ApplicationForm,
	companyName: string,
): { label: string; value: string }[] {
	const students =
		form.minStudents === form.maxStudents
			? String(form.maxStudents)
			: `${form.minStudents}–${form.maxStudents}`;
	const invoice = form.billing.ehf ? "EHF" : `E-post til ${form.billing.email}`;

	return [
		{ label: "Bedrift", value: `${companyName}, ${form.orgNumber}` },
		{ label: "Type", value: EVENT_TYPE_LABELS[form.eventType] },
		{ label: "Studenter", value: students },
		{ label: "Datoer", value: form.availableDates.map(formatSemesterDay).join(", ") },
		{ label: "Sted", value: VENUE_LABELS[form.venue] },
		{ label: "Escape", value: ESCAPE_LABELS[form.wantsToUseEscape] },
		{
			label: "Faktura",
			value: form.billing.reference ? `${invoice}, ref. ${form.billing.reference}` : invoice,
		},
	];
}
