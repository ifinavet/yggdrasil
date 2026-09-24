"use node";

import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { feedbackEmailContent } from "./content";
import { deliveryArgs } from "./messages";

export const sendFeedbackEmail = internalAction({
	args: deliveryArgs,
	handler: async (ctx, args): Promise<void> => {
		const context = await ctx.runQuery(internal.feedback.delivery.messages.prepareEmail, {
			...args,
			now: Date.now(),
		});
		if (!context) return;
		const content = await feedbackEmailContent(context, args.round);
		await ctx.runMutation(internal.feedback.delivery.messages.enqueueEmail, {
			...args,
			...content,
		});
	},
});
