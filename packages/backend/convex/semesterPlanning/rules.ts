import type { Infer } from "convex/values";
import type { applicationStatus, presentationEventType } from "./schema";

export type ApplicationStatus = Infer<typeof applicationStatus>;
export type PresentationEventType = Infer<typeof presentationEventType>;

/** Version of the Hugin application form. Bump it when the questions change. */
export const FORM_VERSION = 1;

/** Version of the storage consent text the company accepts on Hugin. */
export const CONSENT_VERSION = "2026-10";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
	applied: "Søkt",
	offer_sent: "Tilbud sendt",
	new_date_requested: "Ny dato ønsket",
	confirmed: "Bekreftet",
	rejected: "Avslått",
	withdrawn: "Trukket",
};

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

/** The most students each event type allows; `null` means no upper limit. */
export const STUDENT_CAP: Record<PresentationEventType, number | null> = {
	standard_presentation: 40,
	large_presentation: null,
	workshop: 40,
	social: 40,
};
