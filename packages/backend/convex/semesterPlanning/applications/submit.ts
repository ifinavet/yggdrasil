"use node";

import { render } from "@react-email/render";
import CompanyApplicationConfirmEmail from "@workspace/emails/company-application-confirm-email";
import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { COMPANY_CONTACT_EMAIL, INFO_EMAIL } from "@workspace/shared/constants/contact";
import { APPLICATION_CONFIRM_PATH } from "@workspace/shared/semester/application";
import { isValidOrgNumber } from "@workspace/shared/semester/orgNumber";
import { SUBMISSION_ID_PATTERN } from "@workspace/shared/validation";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { type ActionCtx, action } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { orderResend } from "../../jobListingOrders/emails";
import { generateLinkToken } from "../../lib/tokens";
import { rateLimiter } from "../rateLimits";
import { fetchBrregUnit, RegistryUnavailableError } from "../registry/client";
import { BLOCKED_MESSAGES, REGISTRY_UNAVAILABLE_MESSAGE } from "../registry/messages";
import { applicationForm } from "../schema";
import { parseApplicationForm } from "./confirmation";

const OUTDATED_FORM_MESSAGE =
	"Skjemaet har blitt oppdatert siden dere åpnet det. Last inn siden på nytt, så er dere i gang igjen. Svarene deres er lagret.";

export function confirmationUrl(token: string): string {
	const url = new URL(APPLICATION_CONFIRM_PATH, isLocalDevelopment() ? HUGIN_LOCAL_URL : HUGIN_URL);
	url.hash = new URLSearchParams({ token }).toString();
	return url.toString();
}

/** Emails the link that confirms the application. Locally the link is only logged. */
async function sendConfirmationEmail(
	ctx: ActionCtx,
	{ email, companyName, token }: Readonly<{ email: string; companyName: string; token: string }>,
) {
	const url = confirmationUrl(token);
	if (isLocalDevelopment()) {
		console.log(`Bekreftelseslenke for søknaden fra ${companyName}: ${url}`);
		return;
	}
	const html = await render(CompanyApplicationConfirmEmail({ companyName, url }));
	await orderResend.sendEmail(ctx, {
		from: `Navet <${INFO_EMAIL}>`,
		replyTo: [COMPANY_CONTACT_EMAIL],
		to: email,
		subject: "Bekreft søknaden deres om bedriftsarrangement",
		html,
	});
}

/**
 * Receives an application from Hugin and emails the contact person a link to confirm it. Public and
 * unauthenticated, so it trusts nothing from the browser: it validates the form again, looks the
 * company up in brreg again, refuses deleted, bankrupt and liquidated companies, and rate limits per
 * company. Navet only sees the application once it is confirmed. It returns null so it never
 * reveals stored data.
 *
 * @param {Id<"semesters">} semesterId - The semester the company applies for.
 * @param {ApplicationForm} form - The answers.
 * @param {string} submissionId - A one-time id from the form, so a retry saves one application.
 * @param {string} [website] - A hidden honeypot field; bots fill it in, people don't.
 *
 * @throws - A Norwegian error when the form, company, semester or dates are not accepted.
 * @returns {null} - Always null.
 */
export const submit = action({
	args: {
		semesterId: v.id("semesters"),
		form: applicationForm,
		submissionId: v.string(),
		website: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, { semesterId, form, submissionId, website }) => {
		// Answer a filled-in honeypot like a success, so bots learn nothing.
		if (website?.trim()) return null;

		if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
			throw new ConvexError(OUTDATED_FORM_MESSAGE);
		}

		const parsed = parseApplicationForm(form);
		if (!isValidOrgNumber(parsed.orgNumber)) {
			throw new ConvexError("Organisasjonsnummeret er ugyldig.");
		}

		const perCompany = await rateLimiter.limit(ctx, "submitApplication", { key: parsed.orgNumber });
		const overall = await rateLimiter.limit(ctx, "submitApplicationGlobal");
		if (!perCompany.ok || !overall.ok) {
			throw new ConvexError(
				"Det har kommet mange søknader på kort tid. Vent litt, og prøv igjen om en stund.",
			);
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

		const token = generateLinkToken();
		const to = await ctx.runMutation(
			internal.semesterPlanning.applications.confirmation.savePending,
			{
				semesterId,
				form: parsed,
				submissionId,
				registry: lookup.snapshot,
				token,
			},
		);
		if (to) await sendConfirmationEmail(ctx, { ...to, token });
		return null;
	},
});

/** Emails a new link for an application that is not confirmed yet. */
export const resendConfirmation = action({
	args: { submissionId: v.string() },
	returns: v.null(),
	handler: async (ctx, { submissionId }) => {
		if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
			throw new ConvexError(OUTDATED_FORM_MESSAGE);
		}
		const limit = await rateLimiter.limit(ctx, "resendApplicationConfirmation", {
			key: submissionId,
		});
		if (!limit.ok)
			throw new ConvexError("Vi har nettopp sendt en e-post. Vent litt før dere ber om en ny.");

		const token = generateLinkToken();
		const to = await ctx.runMutation(
			internal.semesterPlanning.applications.confirmation.addConfirmationToken,
			{ submissionId, token },
		);
		if (to) await sendConfirmationEmail(ctx, { ...to, token });
		return null;
	},
});
