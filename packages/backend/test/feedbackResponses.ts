import type { Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";

export async function insertFeedbackResponses(
	ctx: MutationCtx,
	{
		campaignId,
		formVersionId,
		userId,
		count,
		submittedAt,
	}: {
		campaignId: Id<"feedbackCampaigns">;
		formVersionId: Id<"formVersions">;
		userId: Id<"users">;
		count: number;
		submittedAt: number;
	},
) {
	for (let i = 0; i < count; i++) {
		const inviteId = await ctx.db.insert("feedbackInvites", {
			campaignId,
			userId,
			responded: true,
			bounced: false,
			complained: false,
			delivered: false,
			sent: false,
		});
		await ctx.db.insert("formResponses", {
			campaignId,
			formVersionId,
			inviteId,
			submittedAt,
			data: {
				satisfaction: i % 2 ? 3 : 5,
				impression: 4,
				expectation: 3,
				toughts: `Bra ${i}`,
				improvements: `Mer tid ${i}`,
				want_to_work: i % 2 ? "nei" : "ja",
				word_of_mouth: ["Ifinavet.no", `Fra noen ${i}`],
				other: "",
			},
		});
	}
}
