import type { SemesterTerm } from "./time";

// Norwegian labels for the stored semester planning values, shared by Hugin, Bifrost and emails.

export const EVENT_TYPES = [
	"standard_presentation",
	"large_presentation",
	"workshop",
	"social",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
	standard_presentation: "Ordinær bedriftspresentasjon",
	large_presentation: "Stor bedriftspresentasjon",
	workshop: "Faglig arrangement, workshop eller kurs",
	social: "Sosialt arrangement",
};

export const VENUES = ["campus", "own_premises", "undecided"] as const;
export const VENUE_LABELS: Record<(typeof VENUES)[number], string> = {
	campus: "På campus (IFI)",
	own_premises: "Egne lokaler",
	undecided: "Avgjøres senere",
};

export const ESCAPE_ANSWERS = ["yes", "no", "unsure"] as const;
export const ESCAPE_LABELS: Record<(typeof ESCAPE_ANSWERS)[number], string> = {
	yes: "Ja",
	no: "Nei",
	unsure: "Usikker",
};

export const FOOD_PURCHASERS = ["company", "navet", "undecided"] as const;
export const FOOD_PURCHASER_LABELS: Record<(typeof FOOD_PURCHASERS)[number], string> = {
	company: "Vi ordner selv",
	navet: "Navet legger ut og kjøper inn",
	undecided: "Bestemmes senere",
};

export const APPLICATION_STATUSES = [
	"applied",
	"offer_sent",
	"new_date_requested",
	"confirmed",
	"rejected",
	"withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
	applied: "Søkt",
	offer_sent: "Tilbud sendt",
	new_date_requested: "Ny dato ønsket",
	confirmed: "Bekreftet",
	rejected: "Avslått",
	withdrawn: "Trukket",
};

export const TERM_LABELS: Record<SemesterTerm, string> = { spring: "Våren", autumn: "Høsten" };

/** «Våren 2027», or «våren 2027» inside a sentence. */
export function semesterName(
	term: SemesterTerm,
	year: number,
	{ inSentence = false } = {},
): string {
	const label = TERM_LABELS[term];
	return `${inSentence ? label.toLowerCase() : label} ${year}`;
}

/**
 * What to show for a closed semester date. A date is closed whenever it has a closed label, and an
 * empty label means it was closed without a reason.
 */
export function closedDateLabel(closedLabel: string): string {
	return closedLabel.trim() || "Stengt";
}
