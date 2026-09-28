import { feedbackFieldsSchema } from "@workspace/shared/feedback";
import { addResponseToReport, createReportQuestions } from "@workspace/shared/feedback/report";
import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import { getRegistrantStatistics } from "../../events/registrations/statistics";
import { latestCampaign } from "../delivery/campaigns";
import { canViewReport, isReportFeatureEnabled } from "./access";

export const maxLiveResponses = 500;

export const getLiveReport = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		if (!(await canViewReport(ctx)) || !isReportFeatureEnabled()) return null;
		const event = await ctx.db.get(eventId);
		const campaign = await latestCampaign(ctx, eventId);
		const formVersionId = campaign?.formVersionId;
		if (!event || !campaign || !formVersionId || campaign.retainedAt !== undefined) return null;
		const [company, storedFields, responses] = await Promise.all([
			ctx.db.get(event.hostingCompany),
			ctx.db
				.query("formFields")
				.withIndex("by_formVersionId_and_order", (index) =>
					index.eq("formVersionId", formVersionId),
				)
				.take(41),
			ctx.db
				.query("formResponses")
				.withIndex("by_campaignId", (index) => index.eq("campaignId", campaign._id))
				.order("desc")
				.take(maxLiveResponses),
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
			campaignStatus: campaign.status,
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
		};
	},
});
