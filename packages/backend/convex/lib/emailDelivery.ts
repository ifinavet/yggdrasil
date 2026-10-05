import type { EmailEvent } from "@convex-dev/resend";

const failureStatuses = ["delayed", "failed", "bounced", "complained"] as const;
export const EMAIL_DELIVERY_STATUSES = ["queued", "sent", "delivered", ...failureStatuses] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export const EMAIL_DELIVERY_EVENT_STATUSES: Readonly<
	Record<string, EmailDeliveryStatus | undefined>
> = {
	"email.sent": "sent",
	"email.delivered": "delivered",
	"email.delivery_delayed": "delayed",
	"email.bounced": "bounced",
	"email.complained": "complained",
	"email.failed": "failed",
	"email.suppressed": "failed",
} satisfies Partial<Record<EmailEvent["type"] | "email.suppressed", EmailDeliveryStatus>>;

export function isEmailDeliveryFailure(status: string) {
	return (failureStatuses as readonly string[]).includes(status);
}

function isTerminalFailure(status: string) {
	return status !== "delayed" && isEmailDeliveryFailure(status);
}

export function canUpdateEmailDeliveryStatus(current: string, next: EmailDeliveryStatus) {
	return (
		!isTerminalFailure(current) &&
		(current !== "delivered" || next === "delivered" || isTerminalFailure(next))
	);
}
