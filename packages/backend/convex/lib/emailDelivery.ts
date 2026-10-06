import type { EmailEvent } from "@convex-dev/resend";

export const EMAIL_DELIVERY_FAILURE_STATUSES = [
	"delayed",
	"failed",
	"bounced",
	"complained",
] as const;
export const EMAIL_DELIVERY_STATUSES = [
	"queued",
	"sent",
	"delivered",
	...EMAIL_DELIVERY_FAILURE_STATUSES,
] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export const EMAIL_DELIVERY_ERRORS: Partial<Record<EmailDeliveryStatus, string>> = {
	delayed: "Leveringen er forsinket. Sjekk leveringsstatus før ny sending.",
	bounced: "Mottakerens server avviste e-posten. Kontroller adressen.",
	complained: "E-posten ble markert som søppelpost. Følg opp manuelt.",
	failed: "E-posten kunne ikke sendes. Kontroller leveringsoppsettet.",
};

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
	return (EMAIL_DELIVERY_FAILURE_STATUSES as readonly string[]).includes(status);
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
