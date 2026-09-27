import { formatOsloDate, formatSemesterDay } from "@workspace/shared/time";

// How semester planning writes days, moments and numbers. A semester day is an Oslo "YYYY-MM-DD"
// string; a moment (sent, answered, logged) is epoch milliseconds, shown in Oslo time whatever the
// browser's time zone.

// date-fns patterns for a moment.
const MOMENT_STYLES = {
	/** «3. des» */
	day: "d. MMM",
	/** «3. des, 14:12» */
	dayTime: "d. MMM, HH:mm",
	/** «3. desember» */
	longDay: "d. MMMM",
	/** «14:12» */
	time: "HH:mm",
} as const;

/** An epoch moment in Oslo time, without the full stop Norwegian puts after a short month. */
export function formatMoment(epoch: number, style: keyof typeof MOMENT_STYLES): string {
	return formatOsloDate(epoch, MOMENT_STYLES[style]).replace(/\.(?=,|$)/, "");
}

export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A semester day in a sentence: «tir 9. feb». */
export function shortDay(date: string): string {
	return formatSemesterDay(date, "short").replace(/\.$/, "");
}

/** A semester day on its own, as on a chip or in a column: «Tir 9. feb». */
export function shortDayTitle(date: string): string {
	return capitalize(shortDay(date));
}

/** A semester day written out, where the year goes without saying: «tirsdag 9. februar». */
export function longDay(date: string): string {
	return formatSemesterDay(date, "longNoYear");
}

/** «16–40», or «40» when the company gave one number. */
export function studentRange(min: number, max: number): string {
	return min === max ? String(max) : `${min}–${max}`;
}

/** «924 773 189» */
export function formatOrgNumber(orgNumber: string): string {
	return orgNumber.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ");
}

const OR_LIST = new Intl.ListFormat("nb-NO", { type: "disjunction" });

/** «tir 2. mar eller tor 4. mar» */
export function daysList(dates: readonly string[]): string {
	return OR_LIST.format(dates.map(shortDay));
}

/** The day of the month of a semester day: 9 for «2027-02-09». */
export function dayOfMonth(date: string): number {
	return Number(date.slice(8, 10));
}

/** «Februar», the month a semester day is in. */
export function monthLabel(date: string): string {
	return capitalize(formatSemesterDay(date, "month"));
}

/** «SK» for «Sara Kristiansen». */
export function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
}
