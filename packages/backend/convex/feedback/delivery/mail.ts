"use node";

import { render } from "@react-email/render";
import FeedbackEmail from "@workspace/emails/feedback-email";
import { internal } from "../../_generated/api";
import { env, internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { generateToken } from "../../lib/tokens";
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
			env.HUGIN_BASE_URL ?? (isLocalDevelopment() ? "http://localhost:3003" : ""),
		);
		if (origin.protocol !== "https:" && !isLocalDevelopment())
			throw new Error("HUGIN_BASE_URL must use HTTPS");
		const token = generateToken();
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
