"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { reportEmailContent } from "../delivery/content";

export const sendReportEmail = internalAction({
	args: { reportId: v.id("feedbackReports") },
	handler: async (ctx, { reportId }): Promise<void> => {
		try {
			const report = await ctx.runQuery(internal.feedback.reports.messages.getDelivery, {
				reportId,
			});
			if (!report) return;
			const { token, html, url } = await reportEmailContent(report);
			await ctx.runMutation(internal.feedback.reports.messages.enqueue, {
				reportId,
				token,
				html,
				url,
			});
		} catch {
			await ctx.runMutation(internal.feedback.reports.messages.failed, { reportId });
		}
	},
});
