import type { EmailId, SendEmailOptions } from "@convex-dev/resend";
import { vi } from "vitest";
import { orderResend } from "../convex/jobListingOrders/emails";

// Order and application confirmation emails go out through `orderResend`. These catch them, so a
// test can follow the emailed link like a person would.

export function sentEmails() {
	return vi.spyOn(orderResend, "sendEmail").mockResolvedValue("email-id" as EmailId);
}

export function emailsFrom(spy: ReturnType<typeof sentEmails>) {
	return spy.mock.calls.map((call) => (call as unknown as [unknown, SendEmailOptions])[1]);
}

/** The token in a `…/bekreft#token=…` link. */
export function tokenFrom(html: string | undefined) {
	const token = html?.match(/bekreft#token=([\w-]+)/)?.[1];
	if (!token) throw new Error("No confirmation link in the email");
	return token;
}
