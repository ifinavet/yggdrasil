import { feedbackErrors } from "@workspace/shared/feedback";
import { v } from "convex/values";
import { type MutationCtx, mutation } from "../../_generated/server";
import { cancelInvitationEmails } from "../delivery/messages";
import { feedbackAnswers } from "../schema";
import { type FeedbackAccess, getFeedbackTokenAccess, getOwnFeedbackInviteAccess } from "./access";

type FeedbackAnswers = typeof feedbackAnswers.type;

async function submitResponse(
	ctx: MutationCtx,
	access: FeedbackAccess,
	answers: FeedbackAnswers,
	submittedAt: number,
) {
	if (access.status !== "open") return access;
	const errors = feedbackErrors(access.fields, answers);
	if (Object.keys(errors).length > 0) return { status: "validation-error", errors } as const;
	await ctx.db.insert("formResponses", {
		campaignId: access.campaign._id,
		formVersionId: access.publishedVersion._id,
		inviteId: access.invite._id,
		data: answers,
		submittedAt,
	});
	await ctx.db.patch(access.invite._id, { responded: true });
	await cancelInvitationEmails(ctx, access.invite._id);
	return { status: "submitted" } as const;
}

export const submitFeedbackResponse = mutation({
	args: { token: v.string(), answers: feedbackAnswers },
	handler: async (ctx, { token, answers }) => {
		const submittedAt = Date.now();
		const access = await getFeedbackTokenAccess(ctx, token, submittedAt);
		return submitResponse(ctx, access, answers, submittedAt);
	},
});

export const submitOwnFeedbackResponse = mutation({
	args: { inviteId: v.string(), answers: feedbackAnswers },
	handler: async (ctx, { inviteId, answers }) => {
		const submittedAt = Date.now();
		const access = await getOwnFeedbackInviteAccess(ctx, inviteId, submittedAt);
		return submitResponse(ctx, access, answers, submittedAt);
	},
});
