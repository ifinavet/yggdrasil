import { feedbackFieldsSchema } from "@workspace/shared/feedback";
import { addResponseToReport, createReportQuestions } from "@workspace/shared/feedback/report";
import { feedbackRetentionAt } from "@workspace/shared/feedback/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../../_generated/server";
import { isReportFeatureEnabled, requireReportAccess } from "./access";

export async function prepareReport(ctx: MutationCtx, campaignId: Id<"feedbackCampaigns">) {
	if (!isReportFeatureEnabled()) throw new ConvexError("Rapportfunksjonen er slått av.");
	const existing = await ctx.db
		.query("feedbackReports")
		.withIndex("by_campaignId", (index) => index.eq("campaignId", campaignId))
		.unique();
	if (existing) return existing._id;
	const campaign = await ctx.db.get(campaignId);
	if (campaign?.status !== "closed" || !campaign.formVersionId || campaign.retainedAt !== undefined)
		throw new ConvexError("Rapporten blir tilgjengelig når innsamlingen er avsluttet.");
	const formVersionId = campaign.formVersionId;
	const retentionAt =
		campaign.retentionAt ?? feedbackRetentionAt(campaign.closedAt ?? campaign.closesAt);
	if (Date.now() >= retentionAt) throw new ConvexError("Lagringstiden for rapporten er utløpt.");
	const event = await ctx.db.get(campaign.eventId);
	if (!event) throw new ConvexError("Arrangementet finnes ikke.");
	const company = await ctx.db.get(event.hostingCompany);
	if (!company) throw new ConvexError("Bedriften finnes ikke.");
	const [logo, application, storedFields] = await Promise.all([
		ctx.db.get(company.logo),
		ctx.db
			.query("companyApplications")
			.withIndex("by_eventId", (index) => index.eq("eventId", event._id))
			.first(),
		ctx.db
			.query("formFields")
			.withIndex("by_formVersionId_and_order", (index) => index.eq("formVersionId", formVersionId))
			.take(41),
	]);
	const fields = feedbackFieldsSchema.safeParse(storedFields);
	if (!fields.success) throw new ConvexError("Skjemaversjonen er ugyldig.");
	const reportId = await ctx.db.insert("feedbackReports", {
		campaignId,
		eventId: event._id,
		eventTitle: event.title,
		eventStart: event.eventStart,
		companyName: company.name,
		companyLogoId: logo?.image,
		recipientEmail: application?.contact.email ?? "",
		status: "building",
		questions: createReportQuestions(fields.data),
		totalResponses: 0,
		buildCursor: null,
		revision: 0,
		retentionAt,
	});
	await ctx.scheduler.runAfter(0, internal.feedback.reports.build.buildReportBatch, {
		reportId,
		cursor: null,
	});
	await ctx.scheduler.runAt(retentionAt, internal.feedback.reports.build.expireReport, {
		reportId,
	});
	return reportId;
}

export const prepare = mutation({
	args: { campaignId: v.id("feedbackCampaigns") },
	handler: async (ctx, { campaignId }) => {
		const campaign = await ctx.db.get(campaignId);
		if (!campaign) throw new ConvexError("Innsamlingen finnes ikke.");
		await requireReportAccess(ctx, campaign.eventId);
		return prepareReport(ctx, campaignId);
	},
});

export const buildReportBatch = internalMutation({
	args: { reportId: v.id("feedbackReports"), cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, { reportId, cursor }) => {
		const report = await ctx.db.get(reportId);
		// A retried or duplicated job must not count the same page twice.
		if (report?.status !== "building" || report.buildCursor !== cursor) return;
		if (Date.now() >= report.retentionAt) return;
		const responses = await ctx.db
			.query("formResponses")
			.withIndex("by_campaignId", (index) => index.eq("campaignId", report.campaignId))
			.paginate({ cursor, numItems: 25, maximumBytesRead: 1024 * 1024 });
		let totalResponses = report.totalResponses;
		for (const response of responses.page) {
			const textAnswers = addResponseToReport(report.questions, response.data);
			for (const answer of textAnswers)
				await ctx.db.insert("feedbackReportAnswers", {
					reportId,
					responseId: response._id,
					...answer,
					visible: true,
				});
			totalResponses += 1;
		}
		await ctx.db.patch(reportId, {
			questions: report.questions,
			totalResponses,
			buildCursor: responses.continueCursor,
			status: responses.isDone ? "draft" : "building",
		});
		if (!responses.isDone)
			await ctx.scheduler.runAfter(0, internal.feedback.reports.build.buildReportBatch, {
				reportId,
				cursor: responses.continueCursor,
			});
	},
});

export const prepareClosedReport = internalMutation({
	args: { campaignId: v.id("feedbackCampaigns") },
	handler: async (ctx, { campaignId }) => {
		if (isReportFeatureEnabled()) await prepareReport(ctx, campaignId);
	},
});

export const expireReport = internalMutation({
	args: { reportId: v.id("feedbackReports") },
	handler: async (ctx, { reportId }) => {
		const report = await ctx.db.get(reportId);
		if (!report || Date.now() < report.retentionAt) return;
		await ctx.db.patch(reportId, {
			status: "revoked",
			tokenHash: undefined,
			recipientEmail: "",
			approvedBy: undefined,
		});
		const answers = await ctx.db
			.query("feedbackReportAnswers")
			.withIndex("by_reportId", (index) => index.eq("reportId", reportId))
			.take(100);
		for (const answer of answers) await ctx.db.delete(answer._id);
		const captures = await ctx.db
			.query("feedbackReportLocalEmails")
			.withIndex("by_reportId", (index) => index.eq("reportId", reportId))
			.take(100);
		for (const capture of captures) await ctx.db.delete(capture._id);
		if (answers.length === 100 || captures.length === 100)
			await ctx.scheduler.runAfter(0, internal.feedback.reports.build.expireReport, { reportId });
	},
});
