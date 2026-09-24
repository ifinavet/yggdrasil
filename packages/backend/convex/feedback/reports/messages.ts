import { featureFlags } from "@workspace/shared/feature-flags";
import { feedbackTokenSchema } from "@workspace/shared/feedback";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { hashLinkToken } from "../../lib/tokens";
import { feedbackResend } from "../delivery/messages";

export const getDelivery = internalQuery({
	args: { reportId: v.id("feedbackReports") },
	handler: async (ctx, { reportId }) => {
		const report = await ctx.db.get(reportId);
		return report?.status === "approved" && !report.emailId && report.deliveryStatus === "pending"
			? { eventTitle: report.eventTitle, eventStart: report.eventStart }
			: null;
	},
});
export const enqueue = internalMutation({
	args: { reportId: v.id("feedbackReports"), token: v.string(), html: v.string(), url: v.string() },
	handler: async (ctx, args): Promise<void> => {
		const report = await ctx.db.get(args.reportId);
		if (report?.status !== "approved" || report.emailId || report.deliveryStatus !== "pending")
			return;
		if (
			Date.now() >= report.retentionAt ||
			!featureFlags.huginFeedback.emailsEnabled ||
			!featureFlags.huginFeedback.reportEmailsEnabled
		) {
			await ctx.db.patch(report._id, { deliveryStatus: "failed" });
			return;
		}
		const token = feedbackTokenSchema.parse(args.token);
		const key = `feedback-report:${report._id}:${report.revision}:${report.deliveryAttempt ?? 0}`;
		const emailId = isLocalDevelopment()
			? `local:${key}`
			: await feedbackResend.sendEmail(ctx, {
					from: "Navet <info@ifinavet.no>",
					replyTo: ["arrangement@ifinavet.no"],
					to: report.recipientEmail,
					subject: `Rapport fra ${report.eventTitle}`,
					html: args.html,
					idempotencyKey: key,
				});
		// Queueing and storing the token hash share a transaction, so a retry cannot send a second link.
		await ctx.db.patch(report._id, {
			tokenHash: await hashLinkToken(token),
			emailId,
			deliveryStatus: "queued",
		});
		if (isLocalDevelopment())
			await ctx.db.insert("feedbackReportLocalEmails", {
				reportId: report._id,
				to: report.recipientEmail,
				url: args.url,
				html: args.html,
			});
	},
});
export const failed = internalMutation({
	args: { reportId: v.id("feedbackReports") },
	handler: async (ctx, { reportId }) => {
		const report = await ctx.db.get(reportId);
		if (report?.status === "approved" && !report.emailId)
			await ctx.db.patch(reportId, { deliveryStatus: "failed" });
	},
});
