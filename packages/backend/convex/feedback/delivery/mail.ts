"use node";

import { render } from "@react-email/render";
import FeedbackEmail from "@workspace/emails/feedback-email";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { generateLinkToken } from "../../lib/tokens";
import { feedbackConfig } from "../constants";
import { deliveryArgs } from "./messages";

export const sendFeedbackEmail = internalAction({
	args: deliveryArgs,
	handler: async (ctx, args): Promise<void> => {
		const context = await ctx.runQuery(internal.feedback.delivery.messages.prepareEmail, {
			...args,
			now: Date.now(),
		});
		if (!context) return;
		const origin = new URL(
			isLocalDevelopment() ? "http://localhost:3003" : feedbackConfig.huginBaseUrl,
		);
		const token = generateLinkToken();
		const url = new URL("/feedback", origin);
		// Fragments are available to Hugin without putting the bearer token in HTTP requests or access logs.
		url.hash = new URLSearchParams({ token }).toString();
		const reminder = args.round !== 0;
		const subject = `${reminder ? "Påminnelse" : "Tilbakemelding"}: ${context.title}`;
		const html = await render(
			FeedbackEmail({ event: context.title, url: url.toString(), reminder }),
		);
		await ctx.runMutation(internal.feedback.delivery.messages.enqueueEmail, {
			...args,
			token,
			url: url.toString(),
			subject,
			html,
		});
	},
});
