"use node";

import { render } from "@react-email/render";
import ApplicationsOpenEmail from "@workspace/emails/applications-open-email";
import CompanyInterestEmail from "@workspace/emails/company-interest-email";
import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { COMPANY_CONTACT_EMAIL, INFO_EMAIL } from "@workspace/shared/constants/contact";
import { semesterName } from "@workspace/shared/semester/labels";
import { formatSemesterDay } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
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

/**
 * Tells every company that asked on Hugin that the semester's applications are open, then forgets
 * them. Runs when a semester opens; nothing happens when it has closed again in the meantime.
 */
export const notifyApplicationsOpen = internalAction({
	args: { semesterId: v.id("semesters") },
	returns: v.null(),
	handler: async (ctx, { semesterId }) => {
		const opening = await ctx.runQuery(internal.semesterPlanning.interest.mutations.forOpening, {
			semesterId,
		});
		if (!opening || opening.companies.length === 0) return null;

		const semester = semesterName(opening.term, opening.year, { inSentence: true });
		const deadline = formatSemesterDay(opening.applicationDeadline, "long");
		const url = new URL(
			"/bestill-bedpres",
			isLocalDevelopment() ? HUGIN_LOCAL_URL : HUGIN_URL,
		).toString();
		for (const { companyName, email } of opening.companies) {
			if (isLocalDevelopment()) {
				console.log(`Søknadene er åpne, sier ifra til ${companyName} (${email}).`);
				continue;
			}
			const html = await render(ApplicationsOpenEmail({ companyName, semester, deadline, url }));
			await orderResend.sendEmail(ctx, {
				from: `Navet <${INFO_EMAIL}>`,
				replyTo: [COMPANY_CONTACT_EMAIL],
				to: email,
				subject: `Nå kan dere søke om bedriftsarrangement ${semester}`,
				html,
			});
		}
		await ctx.runMutation(internal.semesterPlanning.interest.mutations.forget, {
			ids: opening.companies.map(({ _id }) => _id),
		});
		return null;
	},
});
