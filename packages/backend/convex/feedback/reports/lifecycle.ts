import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { latestCampaign } from "../delivery/campaigns";

/** Null means feedback/report work is still outstanding; queueing email is not completion. */
export async function followupFinishedAt(
	ctx: MutationCtx,
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
	if (!report && !campaign.formVersionId) return campaign.closedAt ?? campaign.closesAt;
	if (!report || report.status === "building") return null;
	if (report.status !== "revoked" && report.deliveryStatus === "failed") return null;
	if (report.followupFinishedAt !== undefined) return report.followupFinishedAt;
	// Legacy reports have no provider timestamp. Start their safety week on first observation.
	if (
		report.deliveryStatus === "delivered" ||
		report.totalResponses === 0 ||
		report.status === "revoked"
	) {
		const now = Date.now();
		await ctx.db.patch(report._id, { followupFinishedAt: now });
		return now;
	}
	return null;
}
