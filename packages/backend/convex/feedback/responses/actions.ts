import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import type { getFeedbackTokenForm, getOwnFeedbackInviteForm } from "./access";

/** Read-only: scanners and previews cannot consume the invite. Time comes from the server. */
export const resolveFeedbackToken = action({
	args: { token: v.string() },
	handler: async (ctx, { token }): Promise<Awaited<ReturnType<typeof getFeedbackTokenForm>>> => {
		return await ctx.runQuery(internal.feedback.responses.queries.getTokenForm, {
			token,
			now: Date.now(),
		});
	},
});

export const resolveOwnFeedbackInvite = action({
	args: { inviteId: v.string() },
	handler: async (
		ctx,
		{ inviteId },
	): Promise<Awaited<ReturnType<typeof getOwnFeedbackInviteForm>>> => {
		return await ctx.runQuery(internal.feedback.responses.queries.getOwnInviteForm, {
			inviteId,
			now: Date.now(),
		});
	},
});
