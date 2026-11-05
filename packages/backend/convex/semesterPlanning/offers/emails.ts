"use node";

import { render } from "@react-email/render";
import CompanyOfferEmail from "@workspace/emails/company-offer-email";
import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { COMPANY_CONTACT_EMAIL, INFO_EMAIL } from "@workspace/shared/constants/contact";
import { offerPath } from "@workspace/shared/semester/application";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { orderResend } from "../../jobListingOrders/emails";

export function offerUrl(token: string): string {
	return new URL(offerPath(token), isLocalDevelopment() ? HUGIN_LOCAL_URL : HUGIN_URL).toString();
}

export const sendOfferEmail = internalAction({
	args: { offerId: v.id("companyApplicationOffers") },
	returns: v.null(),
	handler: async (ctx, { offerId }) => {
		const offer = await ctx.runQuery(internal.semesterPlanning.offers.queries.emailContext, {
			offerId,
		});
		if (!offer) return null;

		const url = offerUrl(offer.linkToken);
		if (isLocalDevelopment()) {
			console.log(`Tilbudslenke til ${offer.to}: ${url}`);
			return null;
		}

		const { subject, paragraphs } = offer;
		const html = await render(CompanyOfferEmail({ subject, paragraphs, url }));
		await orderResend.sendEmail(ctx, {
			from: `Navet <${INFO_EMAIL}>`,
			replyTo: [COMPANY_CONTACT_EMAIL],
			to: offer.to,
			subject,
			html,
		});
		return null;
	},
});
