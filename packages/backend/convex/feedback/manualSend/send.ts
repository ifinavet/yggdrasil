"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import { feedbackEmailContent } from "../delivery/content";

export const send = action({
	args: { eventId: v.id("events"), userId: v.id("users") },
	handler: async (ctx, args): Promise<string> => {
		const email = await ctx.runQuery(internal.feedback.manualSend.eligibility.prepare, args);
		const content = await feedbackEmailContent(email, 0);
		return await ctx.runMutation(internal.feedback.manualSend.eligibility.enqueue, {
			...args,
			...content,
		});
	},
});
