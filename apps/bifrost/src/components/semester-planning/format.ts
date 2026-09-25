import { formatSemesterDay } from "@workspace/shared/semester/time";

// How semester planning writes days. A semester day is an Oslo "YYYY-MM-DD" string.

export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A semester day in a sentence: «tir 9. feb». */
export function shortDay(date: string): string {
	return formatSemesterDay(date, "short").replace(/\.$/, "");
}

/** A semester day written out, where the year goes without saying: «tirsdag 9. februar». */
export function longDay(date: string): string {
	return formatSemesterDay(date, "longNoYear");
}
