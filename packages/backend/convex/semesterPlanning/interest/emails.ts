"use node";

import { render } from "@react-email/render";
import CompanyInterestEmail from "@workspace/emails/company-interest-email";
import { COMPANY_CONTACT_EMAIL, INFO_EMAIL } from "@workspace/shared/constants/contact";
import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { orderResend } from "../../jobListingOrders/emails";

/** Tells Navet that a company wants to know when applications open. A reply goes to the company. */
export const sendInterestEmail = internalAction({
	args: { companyName: v.string(), email: v.string() },
	returns: v.null(),
	handler: async (ctx, { companyName, email }) => {
		if (isLocalDevelopment()) {
			console.log(`${companyName} (${email}) vil vite når søknadene åpner.`);
			return null;
		}

		const html = await render(CompanyInterestEmail({ companyName, email }));
		await orderResend.sendEmail(ctx, {
			from: `Navet <${INFO_EMAIL}>`,
			replyTo: [email],
			to: COMPANY_CONTACT_EMAIL,
			subject: `${companyName} vil vite når søknadene åpner`,
			html,
		});
		return null;
	},
});
