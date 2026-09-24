"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import { hashLinkToken } from "../../lib/tokens";
import { feedbackEmailContent, reportEmailContent } from "../delivery/content";
import { feedbackResend, feedbackSender } from "../delivery/messages";

export const send = action({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }): Promise<number> => {
		const { to, title, eventStart } = await ctx.runQuery(
			internal.feedback.testSend.access.recipient,
			{ eventId },
		);
		const [invitation, reminder, report] = await Promise.all([
			feedbackEmailContent(title, 0),
			feedbackEmailContent(title, 3),
			reportEmailContent(title, eventStart),
		]);
		await ctx.runMutation(internal.feedback.testSend.report.storeReportLink, {
			eventId,
			tokenHash: await hashLinkToken(report.token),
		});
		const emails = [invitation, reminder, report];
		for (const { subject, html } of emails)
			await feedbackResend.sendEmail(ctx, { ...feedbackSender, to, subject, html });
		return emails.length;
	},
});
