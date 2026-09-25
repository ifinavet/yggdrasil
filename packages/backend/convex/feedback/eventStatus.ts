import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { latestCampaign } from "./delivery/campaigns";
import { isReportFeatureEnabled } from "./reports/access";

export type EventFeedbackStatus = "draft" | "delivered" | "open" | "scheduled";

export async function eventFeedbackStatus(
	ctx: QueryCtx,
	eventId: Id<"events">,
	canViewReport: boolean,
): Promise<EventFeedbackStatus | null> {
	const campaign = await latestCampaign(ctx, eventId);
	if (!campaign) return null;
	if (canViewReport && isReportFeatureEnabled()) {
		const report = await ctx.db
			.query("feedbackReports")
			.withIndex("by_campaignId", (index) => index.eq("campaignId", campaign._id))
			.unique();
		if (report?.status === "draft") return "draft";
		if (report?.status === "approved" && report.deliveryStatus === "delivered") return "delivered";
	}
	if (campaign.status === "open" || campaign.status === "scheduled") return campaign.status;
	return null;
}
