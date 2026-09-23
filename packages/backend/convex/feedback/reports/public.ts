import { feedbackTokenSchema } from "@workspace/shared/feedback";
import type { FeedbackReport, ReportTextAnswer } from "@workspace/shared/feedback/report";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action, internalQuery } from "../../_generated/server";
import { hashLinkToken } from "../../lib/tokens";

export const readPage = internalQuery({
	args: { token: v.string(), now: v.number(), paginationOpts: paginationOptsValidator },
	handler: async (ctx, { token, now, paginationOpts }) => {
		if (!feedbackTokenSchema.safeParse(token).success) return null;
		const tokenHash = await hashLinkToken(token);
		const report = await ctx.db
			.query("feedbackReports")
			.withIndex("by_tokenHash", (index) => index.eq("tokenHash", tokenHash))
			.unique();
		if (report?.status !== "approved" || now >= report.retentionAt) return null;
		const campaign = await ctx.db.get(report.campaignId);
		if (!campaign || campaign.retainedAt !== undefined) return null;
		const answers = await ctx.db
			.query("feedbackReportAnswers")
			.withIndex("by_reportId_and_visible", (index) =>
				index.eq("reportId", report._id).eq("visible", true),
			)
			.paginate({
				...paginationOpts,
				numItems: Math.min(paginationOpts.numItems, 100),
				maximumBytesRead: 512 * 1024,
			});
		// Only this explicit projection is public. Contact, participant and moderation metadata stay internal.
		return {
			report: {
				eventTitle: report.eventTitle,
				eventStart: report.eventStart,
				companyName: report.companyName,
				companyLogoUrl: report.companyLogoId
					? await ctx.storage.getUrl(report.companyLogoId)
					: null,
				totalResponses: report.totalResponses,
				questions: report.questions,
				registrants: report.registrants,
			},
			answers: answers.page.map((answer) => ({
				id: answer._id,
				fieldKey: answer.fieldKey,
				text: answer.text,
				visible: true,
			})),
			continueCursor: answers.continueCursor,
			isDone: answers.isDone,
		};
	},
});
export const resolveReport = action({
	args: { token: v.string(), paginationOpts: paginationOptsValidator },
	handler: async (
		ctx,
		args,
	): Promise<{
		report: FeedbackReport;
		answers: ReportTextAnswer[];
		continueCursor: string;
		isDone: boolean;
	} | null> =>
		ctx.runQuery(internal.feedback.reports.public.readPage, { ...args, now: Date.now() }),
});
