"use node";

import { render } from "@react-email/render";
import CompanyApplicationConfirmEmail from "@workspace/emails/company-application-confirm-email";
import CompanyOfferEmail from "@workspace/emails/company-offer-email";
import {
	confirmEmailFor,
	EMAIL_PREVIEW,
	offerEmailFor,
} from "@workspace/shared/semester/company-emails";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import { confirmationUrl } from "../applications/submit";
import { offerUrl } from "../offers/emails";

/**
 * The whole email a company gets, rendered from the same template that sends it, with an editor's
 * subject and text that are not saved yet. Written for {@link EMAIL_PREVIEW}.
 *
 * @param {"confirm" | "offer"} kind - The confirm email or the offer email.
 * @param {string} subject - The subject, with placeholders.
 * @param {string} text - The text, with placeholders.
 *
 * @throws - An error if the caller is not an internal member.
 * @returns {{ subject: string, html: string }} - The filled-in subject and the email's HTML.
 */
export const previewCompanyEmail = action({
	args: {
		kind: v.union(v.literal("confirm"), v.literal("offer")),
		subject: v.string(),
		text: v.string(),
	},
	returns: v.object({ subject: v.string(), html: v.string() }),
	handler: async (ctx, { kind, subject, text }) => {
		await ctx.runQuery(internal.semesterPlanning.semesters.queries.requireInternalMember, {});

		if (kind === "confirm") {
			const content = confirmEmailFor(
				{ confirmEmailSubject: subject, confirmEmailText: text },
				EMAIL_PREVIEW.companyName,
			);
			const url = confirmationUrl("eksempel");
			return {
				subject: content.subject,
				html: await render(CompanyApplicationConfirmEmail({ ...content, url })),
			};
		}
		const content = offerEmailFor(
			{ offerEmailSubject: subject, offerEmailText: text },
			EMAIL_PREVIEW,
		);
		const url = offerUrl("eksempel");
		return { subject: content.subject, html: await render(CompanyOfferEmail({ ...content, url })) };
	},
});
