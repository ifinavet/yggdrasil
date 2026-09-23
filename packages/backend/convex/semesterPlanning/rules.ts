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

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
	return TRANSITIONS[from].includes(to);
}

/** Rejected and withdrawn applications no longer hold a date or a valid offer. */
export function isLiveStatus(status: ApplicationStatus): boolean {
	return status !== "rejected" && status !== "withdrawn";
}

/** The most students each event type allows; `null` means no upper limit. */
export const STUDENT_CAP: Record<PresentationEventType, number | null> = {
	standard_presentation: 40,
	large_presentation: null,
	workshop: 40,
	social: 40,
};

/**
 * Validates an organization number: 9 digits with the modulus 11 check digit that Brønnøysund uses.
 * Spaces are ignored.
 */
export function isValidOrgNumber(value: string): boolean {
	const digits = normalizeOrgNumber(value);
	if (!/^\d{9}$/.test(digits)) return false;

	const weights = [3, 2, 7, 6, 5, 4, 3, 2];
	const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
	const remainder = sum % 11;
	const check = remainder === 0 ? 0 : 11 - remainder;

	return check !== 10 && check === Number(digits[8]);
}

/** Removes spaces, so "924 773 189" and "924773189" are the same number. */
export function normalizeOrgNumber(value: string): string {
	return value.replace(/\s/g, "");
}

/** Company profiles store the organization number as a number. */
export function toCompanyOrgNumber(orgNumber: string): number {
	return Number(normalizeOrgNumber(orgNumber));
}
