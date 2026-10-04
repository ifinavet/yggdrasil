import { Resend } from "@convex-dev/resend";
import { components, internal } from "../_generated/api";

// Keep the existing queue and webhook identity: reminders and feedback use this too.
export const trackedEmail: Resend = new Resend(components.feedbackResend, {
	testMode: false,
	onEmailEvent: internal.feedback.delivery.messages.onEmailEvent,
});
