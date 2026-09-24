import type { ApplicationStatus } from "@workspace/shared/semester/labels";

/** Version of the Hugin application form. Bump it when the questions change. */
export const FORM_VERSION = 1;

/** Version of the storage consent text the company accepts on Hugin. */
export const CONSENT_VERSION = "2026-10";

/**
 * Every allowed status change. A confirmed application can only be withdrawn: to move it to
 * another date, the editor withdraws it, reopens it and sends a new offer.
 */
export const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
	applied: ["offer_sent", "rejected", "withdrawn"],
	offer_sent: ["confirmed", "new_date_requested", "offer_sent", "applied", "withdrawn"],
	new_date_requested: ["offer_sent", "applied", "rejected", "withdrawn"],
	confirmed: ["withdrawn"],
	rejected: ["applied"],
	withdrawn: ["applied"],
};

/** Whether `TRANSITIONS` allows moving an application from one status to another. */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
	return TRANSITIONS[from].includes(to);
}

/** Whether the application still holds its date and offer; rejected and withdrawn ones do not. */
export function isActiveApplicationStatus(status: ApplicationStatus): boolean {
	return status !== "rejected" && status !== "withdrawn";
}
