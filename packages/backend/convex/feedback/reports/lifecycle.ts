import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { latestCampaign } from "../delivery/campaigns";

/** Null means feedback/report work is still outstanding; queueing email is not completion. */
export async function followupFinishedAt(
	ctx: QueryCtx,
	event: Doc<"events">,
): Promise<number | null> {
	const campaign = await latestCampaign(ctx, event._id);
	if (!campaign) return event.feedbackEnabled ? null : event.eventStart;
	if (campaign.status === "cancelled") return campaign.closedAt ?? event.eventStart;
	if (campaign.status !== "closed") return null;
	const report = await ctx.db
		.query("feedbackReports")
		.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
		.unique();
	if (!report || report.status === "building" || report.deliveryStatus === "failed") return null;
	return report.followupFinishedAt ?? null;
}
