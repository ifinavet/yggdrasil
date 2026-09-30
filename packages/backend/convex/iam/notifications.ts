import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { slackConfig } from "./config";
import { slackClient } from "./slack";

const MAX_ATTEMPTS = 3;

export const sendMessage = internalAction({
	args: {
		channel: v.string(),
		text: v.string(),
		clientMsgId: v.string(),
		attempt: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, { channel, text, clientMsgId, attempt = 1 }) => {
		const config = slackConfig();
		if (!config) return null;

		try {
			await slackClient(config).postMessage(channel, text, clientMsgId);
		} catch (error) {
			if (attempt < MAX_ATTEMPTS) {
				await ctx.scheduler.runAfter(attempt * 10_000, internal.iam.notifications.sendMessage, {
					channel,
					text,
					clientMsgId,
					attempt: attempt + 1,
				});
			}
			throw error;
		}
		return null;
	},
});
