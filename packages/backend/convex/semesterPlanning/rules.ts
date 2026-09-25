import type { ApplicationStatus } from "@workspace/shared/semester/labels";

/** Version of the Hugin application form. Bump it when the questions change. */
export const FORM_VERSION = 1;

/** Version of the storage consent text the company accepts on Hugin. */
export const CONSENT_VERSION = "2026-10";

/**
 * Every allowed status change. A confirmed application goes back to «Søkt» only by moving it to
 * another date, and every closed application can be reopened as «Søkt».
 */
export const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
	applied: ["offer_sent", "rejected", "withdrawn"],
	offer_sent: ["confirmed", "new_date_requested", "declined", "applied", "rejected", "withdrawn"],
	new_date_requested: ["offer_sent", "declined", "applied", "rejected", "withdrawn"],
	confirmed: ["applied", "withdrawn"],
	declined: ["applied"],
	rejected: ["applied"],
	withdrawn: ["applied"],
};

/** Whether `TRANSITIONS` allows moving an application from one status to another. */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
	return TRANSITIONS[from].includes(to);
}

/** Whether the application still holds its date and offer; declined, rejected and withdrawn ones do not. */
export function isActiveApplicationStatus(status: ApplicationStatus): boolean {
	return status !== "declined" && status !== "rejected" && status !== "withdrawn";
}

/** Whether the application still waits for an offer or an answer, so the plan is not finished. */
export function isUnsettledApplicationStatus(status: ApplicationStatus): boolean {
	return status === "applied" || status === "offer_sent" || status === "new_date_requested";
}
