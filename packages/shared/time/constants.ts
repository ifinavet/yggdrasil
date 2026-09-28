export const OSLO_TIME_ZONE = "Europe/Oslo";

/**
 * First month of the autumn term, zero-based (July). January to June belongs to spring. Semester
 * planning, event slugs and the event calendar all split the year here.
 */
export const AUTUMN_FIRST_MONTH = 6;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const DATE_PATTERNS = {
	time: "HH:mm",
	shortDate: "d. MMM",
	shortDateWithYear: "d. MMM yyyy",
	dateTime: "EEEE d. MMMM, HH:mm",
	month: "LLLL",
	monthKey: "yyyy-MM",
	numericDate: "dd.MM.yyyy",
	longDate: "PPP",
} as const;

export const WORKDAY_LABELS = { 1: "Man", 2: "Tir", 3: "Ons", 4: "Tor", 5: "Fre" } as const;
export const WORKDAYS = Object.keys(WORKDAY_LABELS).map(Number);
