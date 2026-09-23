"use node";

import { render } from "@react-email/render";
import FeedbackReportEmail from "@workspace/emails/feedback-report-email";
import { formatFeedbackDate } from "@workspace/shared/feedback/time";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { env, internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { generateLinkToken } from "../../lib/tokens";

export const sendReportEmail = internalAction({
	args: { reportId: v.id("feedbackReports") },
	handler: async (ctx, { reportId }): Promise<void> => {
		try {
			const report = await ctx.runQuery(internal.feedback.reports.messages.getDelivery, {
				reportId,
			});
			if (!report) return;
			const origin = new URL(
				env.HUGIN_BASE_URL ?? (isLocalDevelopment() ? "http://localhost:3003" : ""),
			);
			if (origin.protocol !== "https:" && !isLocalDevelopment())
				throw new Error("HUGIN_BASE_URL must use HTTPS");
			const token = generateLinkToken();
			const url = new URL("/report", origin);
			url.hash = new URLSearchParams({ token }).toString();
			const html = await render(
				FeedbackReportEmail({
					eventDate: formatFeedbackDate(report.eventStart, "d. MMMM"),
					url: url.toString(),
					logoUrl: new URL("/report-navet.webp", origin).toString(),
				}),
			);
			await ctx.runMutation(internal.feedback.reports.messages.enqueue, {
				reportId,
				token,
				html,
				url: url.toString(),
			});
		} catch {
			await ctx.runMutation(internal.feedback.reports.messages.failed, { reportId });
		}
	},
});
