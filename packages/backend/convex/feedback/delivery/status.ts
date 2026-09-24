import { feedbackRoundAt, REMINDER_DAYS } from "@workspace/shared/feedback/time";
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { latestCampaign } from "./campaigns";

const maxInvites = 2000;
const deliveryRounds = [0, ...REMINDER_DAYS] as const;

function countBy<T>(items: readonly T[], predicate: (item: T) => boolean) {
	return items.filter(predicate).length;
}

function roundSummary(
	campaign: Doc<"feedbackCampaigns">,
	deliveries: readonly Doc<"feedbackDeliveries">[],
	round: (typeof deliveryRounds)[number],
) {
	const sent = deliveries.filter((delivery) => delivery.round === round);
	return {
		round,
		at: feedbackRoundAt(campaign.opensAt, round),
		sent: sent.length,
		delivered: countBy(sent, ({ outcome }) => outcome === "delivered"),
		failed: countBy(sent, ({ outcome }) => outcome === "failed"),
	};
}

export const getEventFeedbackDelivery = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const campaign = await latestCampaign(ctx, eventId);
		if (!campaign || (campaign.status === "cancelled" && !campaign.failure)) return null;
		const [invites, deliveries] = await Promise.all([
			ctx.db
				.query("feedbackInvites")
				.withIndex("by_campaignId", (index) => index.eq("campaignId", campaign._id))
				.take(maxInvites),
			ctx.db
				.query("feedbackDeliveries")
				.withIndex("by_campaignId", (index) => index.eq("campaignId", campaign._id))
				.take(maxInvites * deliveryRounds.length),
		]);
		const rounds = deliveryRounds.map((round) => roundSummary(campaign, deliveries, round));
		return {
			status: campaign.status,
			opensAt: campaign.opensAt,
			closesAt: campaign.closedAt ?? campaign.closesAt,
			failure: campaign.failure,
			rounds,
			invited: invites.length,
			responded: countBy(invites, ({ responded }) => responded),
			failed:
				rounds.reduce((total, { failed }) => total + failed, 0) +
				countBy(invites, ({ failure }) => failure !== undefined),
		};
	},
});
