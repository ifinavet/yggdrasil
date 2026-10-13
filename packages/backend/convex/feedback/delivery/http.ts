import type { HttpRouter } from "convex/server";
import { WebhookVerificationError } from "svix";
import { internal } from "../../_generated/api";
import { httpAction } from "../../_generated/server";
import { capturedEmailEvent } from "../../emailAnalytics/capture";
import { feedbackResend } from "./messages";

export function registerFeedbackEmailRoutes(http: HttpRouter) {
	http.route({
		path: "/resend-webhook",
		method: "POST",
		handler: httpAction(async (ctx, request) => {
			try {
				const raw = await request.clone().text();
				const response = await feedbackResend.handleResendEventWebhook(ctx, request);
				// The signature is verified now. All Resend emails arrive here, whichever queue sent them.
				const event = capturedEmailEvent(JSON.parse(raw));
				if (event) await ctx.scheduler.runAfter(0, internal.emailAnalytics.capture.capture, event);
				return response;
			} catch (error) {
				if (error instanceof WebhookVerificationError)
					return new Response("Invalid signature", { status: 400 });
				throw error;
			}
		}),
	});
}
