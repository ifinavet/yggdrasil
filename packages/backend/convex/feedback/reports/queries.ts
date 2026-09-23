import { featureFlags } from "@workspace/shared/feature-flags";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import { isReportFeatureEnabled, requireReportAccess } from "./access";

export const getEventReport = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireReportAccess(ctx, eventId);
		if (!isReportFeatureEnabled()) return { enabled: false } as const;
		const campaign = await ctx.db
			.query("feedbackCampaigns")
			.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
			.order("desc")
			.first();
		if (!campaign) return null;
		const report = await ctx.db
			.query("feedbackReports")
			.withIndex("by_campaignId", (index) => index.eq("campaignId", campaign._id))
			.unique();
		return {
			enabled: true as const,
			deliveryEnabled:
				featureFlags.huginFeedback.emailsEnabled && featureFlags.huginFeedback.reportEmailsEnabled,
			campaignId: campaign._id,
			campaignStatus: campaign.status,
			report: report
				? {
						...report,
						companyLogoUrl: report.companyLogoId
							? await ctx.storage.getUrl(report.companyLogoId)
							: null,
					}
				: null,
		};
	},
});

export const getReportAnswers = query({
	args: { reportId: v.id("feedbackReports"), paginationOpts: paginationOptsValidator },
	handler: async (ctx, { reportId, paginationOpts }) => {
		const report = await ctx.db.get(reportId);
		if (!report) throw new ConvexError("Rapporten finnes ikke.");
		await requireReportAccess(ctx, report.eventId);
		if (!isReportFeatureEnabled()) throw new ConvexError("Rapportfunksjonen er slått av.");
		if (Date.now() >= report.retentionAt)
			throw new ConvexError("Lagringstiden for rapporten er utløpt.");
		const result = await ctx.db
			.query("feedbackReportAnswers")
			.withIndex("by_reportId", (index) => index.eq("reportId", reportId))
			.paginate({
				...paginationOpts,
				numItems: Math.min(paginationOpts.numItems, 100),
				maximumBytesRead: 512 * 1024,
			});
		return {
			...result,
			page: result.page.map((answer) => ({
				id: answer._id,
				fieldKey: answer.fieldKey,
				text: answer.text,
				visible: answer.visible,
			})),
		};
	},
});
