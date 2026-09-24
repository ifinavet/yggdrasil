"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import { feedbackEmailContent, reportEmailContent } from "../delivery/content";
import { feedbackResend, feedbackSender } from "../delivery/messages";

export const send = action({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }): Promise<number> => {
		const { to, title, eventStart } = await ctx.runQuery(
			internal.feedback.testSend.access.recipient,
			{ eventId },
		);
		const emails = await Promise.all([
			feedbackEmailContent(title, 0),
			feedbackEmailContent(title, 3),
			reportEmailContent(title, eventStart),
		]);
		for (const { subject, html } of emails)
			await feedbackResend.sendEmail(ctx, { ...feedbackSender, to, subject, html });
		return emails.length;
	},
});
