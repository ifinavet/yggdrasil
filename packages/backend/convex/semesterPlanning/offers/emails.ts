"use node";

import { render } from "@react-email/render";
import CompanyOfferEmail from "@workspace/emails/company-offer-email";
import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { offerPath } from "@workspace/shared/semester/application";
import { formatSemesterDay } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { orderResend } from "../../jobListingOrders/emails";

export const sendOfferEmail = internalAction({
	args: { offerId: v.id("companyApplicationOffers") },
	returns: v.null(),
	handler: async (ctx, { offerId }) => {
		const offer = await ctx.runQuery(internal.semesterPlanning.offers.queries.emailContext, {
			offerId,
		});
		if (!offer) return null;

		const url = new URL(
			offerPath(offer.linkToken),
			isLocalDevelopment() ? HUGIN_LOCAL_URL : HUGIN_URL,
		).toString();
		if (isLocalDevelopment()) {
			console.log(`Tilbudslenke til ${offer.to}: ${url}`);
			return null;
		}

		const day = formatSemesterDay(offer.date, "long");
		const firstName = offer.contactName.split(/\s+/)[0] ?? offer.contactName;
		const html = await render(CompanyOfferEmail({ firstName, day, url }));
		await orderResend.sendEmail(ctx, {
			from: "Navet <info@ifinavet.no>",
			replyTo: [COMPANY_CONTACT_EMAIL],
			to: offer.to,
			subject: `Tilbud om bedriftsarrangement ${day}`,
			html,
		});
		return null;
	},
});
