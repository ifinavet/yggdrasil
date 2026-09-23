import { WorkflowManager } from "@convex-dev/workflow";
import { feedbackRoundAt, REMINDER_DAYS } from "@workspace/shared/feedback/time";
import { v } from "convex/values";
import { components, internal } from "../../_generated/api";
import { campaignArgs } from "./campaigns";

const workflow = new WorkflowManager(components.workflow, {
	workpoolOptions: { maxParallelism: 10 },
});

// Keep these definitions stable while campaigns are sleeping; changed sequences need a new version.
export const campaignV1 = workflow
	.define({ args: { ...campaignArgs, opensAt: v.number(), closesAt: v.number() } })
	.handler(async (step, { opensAt, closesAt, ...campaign }): Promise<void> => {
		const opened = await step.runMutation(
			internal.feedback.delivery.campaigns.openCampaign,
			campaign,
			{ runAt: opensAt },
		);
		if (opened)
			await step.runMutation(internal.feedback.delivery.campaigns.closeCampaign, campaign, {
				runAt: closesAt,
			});
	});

export const participantsV1 = workflow
	.define({ args: campaignArgs })
	.handler(async (step, campaign): Promise<void> => {
		let cursor: string | null = null;
		do {
			cursor = await step.runMutation(internal.feedback.delivery.campaigns.inviteParticipants, {
				...campaign,
				cursor,
			});
		} while (cursor !== null);
	});

export const invitationV1 = workflow
	.define({
		args: { inviteId: v.id("feedbackInvites"), generation: v.number(), opensAt: v.number() },
	})
	.handler(async (step, { opensAt, ...invitation }): Promise<void> => {
		for (const round of [0, ...REMINDER_DAYS] as const) {
			await step.runAction(
				internal.feedback.delivery.mail.sendFeedbackEmail,
				{ ...invitation, round },
				{
					runAt: feedbackRoundAt(opensAt, round),
					retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
				},
			);
		}
	});
