import type { HttpRouter } from "convex/server";
import { WebhookVerificationError } from "svix";
import { httpAction } from "../../_generated/server";
import { feedbackResend } from "./messages";

export function registerFeedbackEmailRoutes(http: HttpRouter) {
	http.route({
		path: "/resend-webhook",
		method: "POST",
		handler: httpAction(async (ctx, request) => {
			try {
				return await feedbackResend.handleResendEventWebhook(ctx, request);
			} catch (error) {
				if (error instanceof WebhookVerificationError)
					return new Response("Invalid signature", { status: 400 });
				throw error;
			}
		}),
	});
}
