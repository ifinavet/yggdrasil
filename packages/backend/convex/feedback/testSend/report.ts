import { feedbackFieldsSchema, feedbackTokenSchema } from "@workspace/shared/feedback";
import { addResponseToReport, createReportQuestions } from "@workspace/shared/feedback/report";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "../../_generated/server";
import { getRegistrantStatistics } from "../../events/registrations/statistics";
import { hashLinkToken } from "../../lib/tokens";
import { defaultFeedbackFields } from "../defaultFields";
import { latestCampaign } from "../delivery/campaigns";
import { getLatestPublishedVersion, insertFormVersion, markFormAsDefault } from "../forms/helpers";

const reportLinkLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const defaultFormName = "Standardskjema";
const maxPreviewResponses = 500;

async function previewFormVersionId(
	ctx: QueryCtx,
	eventId: Id<"events">,
	feedbackFormId: Id<"feedbackForms"> | undefined,
) {
	const campaign = await latestCampaign(ctx, eventId);
	if (campaign?.formVersionId) return campaign.formVersionId;
	const formId =
		feedbackFormId ??
		(
			await ctx.db
				.query("feedbackForms")
				.withIndex("by_isDefault", (index) => index.eq("isDefault", true))
				.unique()
		)?._id;
	return formId ? (await getLatestPublishedVersion(ctx, formId))?._id : undefined;
}

export const ensurePreviewForm = internalMutation({
	args: { eventId: v.id("events"), createdBy: v.id("users") },
	handler: async (ctx, { eventId, createdBy }) => {
		const event = await ctx.db.get(eventId);
		if (await previewFormVersionId(ctx, eventId, event?.feedbackFormId)) return;
		const formId = await ctx.db.insert("feedbackForms", {
			name: defaultFormName,
			isDefault: false,
		});
		await insertFormVersion(ctx, {
			formId,
			name: defaultFormName,
			fields: defaultFeedbackFields,
			createdBy,
		});
		await markFormAsDefault(ctx, formId);
	},
});

async function buildPreview(ctx: QueryCtx, eventId: Id<"events">) {
	const event = await ctx.db.get(eventId);
	const formVersionId = await previewFormVersionId(ctx, eventId, event?.feedbackFormId);
	if (!event || !formVersionId) return null;
	const campaign = await latestCampaign(ctx, eventId);
	const [company, storedFields, responses] = await Promise.all([
		ctx.db.get(event.hostingCompany),
		ctx.db
			.query("formFields")
			.withIndex("by_formVersionId_and_order", (index) => index.eq("formVersionId", formVersionId))
			.take(41),
		campaign
			? ctx.db
					.query("formResponses")
					.withIndex("by_campaignId", (index) => index.eq("campaignId", campaign._id))
					.take(maxPreviewResponses)
			: [],
	]);
	const fields = feedbackFieldsSchema.safeParse(storedFields);
	if (!fields.success) throw new ConvexError("Skjemaversjonen er ugyldig.");
	const logo = company ? await ctx.db.get(company.logo) : null;
	const questions = createReportQuestions(fields.data);
	const answers = responses.flatMap((response) =>
		addResponseToReport(questions, response.data).map((answer, index) => ({
			id: `${response._id}:${index}`,
			...answer,
			visible: true,
		})),
	);
	return {
		report: {
			eventTitle: event.title,
			eventStart: event.eventStart,
			companyName: company?.name ?? "",
			companyLogoUrl: logo?.image ? await ctx.storage.getUrl(logo.image) : null,
			totalResponses: responses.length,
			questions,
			registrants: await getRegistrantStatistics(ctx, event._id),
		},
		answers,
		continueCursor: "",
		isDone: true,
	};
}

export const storeReportLink = internalMutation({
	args: { eventId: v.id("events"), tokenHash: v.string() },
	handler: async (ctx, args) => {
		const expiresAt = Date.now() + reportLinkLifetimeMs;
		const linkId = await ctx.db.insert("feedbackTestReportLinks", { ...args, expiresAt });
		await ctx.scheduler.runAt(expiresAt, internal.feedback.testSend.report.expireReportLink, {
			linkId,
		});
	},
});

export const expireReportLink = internalMutation({
	args: { linkId: v.id("feedbackTestReportLinks") },
	handler: async (ctx, { linkId }) => {
		if (await ctx.db.get(linkId)) await ctx.db.delete(linkId);
	},
});

export const readPreview = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: async (ctx, { token, now }) => {
		if (!feedbackTokenSchema.safeParse(token).success) return null;
		const tokenHash = await hashLinkToken(token);
		const link = await ctx.db
			.query("feedbackTestReportLinks")
			.withIndex("by_tokenHash", (index) => index.eq("tokenHash", tokenHash))
			.unique();
		if (!link || now >= link.expiresAt) return null;
		return buildPreview(ctx, link.eventId);
	},
});
