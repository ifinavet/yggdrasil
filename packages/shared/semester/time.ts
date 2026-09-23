import { tz } from "@date-fns/tz";
import { eachDayOfInterval, format, isThursday, isTuesday, isValid, parse } from "date-fns";

// Semester days are Oslo-local "YYYY-MM-DD" strings. All parsing and calendar arithmetic runs in
// the Oslo time zone, so weekdays and wall-clock times stay right across daylight-saving changes.

const IN_OSLO = { in: tz("Europe/Oslo") };
const DAY = "yyyy-MM-dd";
const DAY_AND_TIME = "yyyy-MM-dd HH:mm";

export type SemesterTerm = "spring" | "autumn";

/** Whether the value is a real calendar day written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
	return parseStrict(value, DAY) !== null;
}

/** Today's calendar day in Oslo. */
export function osloToday(now: number): string {
	return format(now, DAY, IN_OSLO);
}

/** An Oslo-local day and "HH:mm" time as epoch milliseconds, across daylight-saving changes. */
export function osloDateTimeToEpoch(date: string, time: string): number {
	return parseStrictOrThrow(`${date} ${time}`, DAY_AND_TIME).getTime();
}

/** Every Tuesday and Thursday from firstDate to lastDate, both inclusive. */
export function tuesdaysAndThursdays(firstDate: string, lastDate: string): string[] {
	return eachDayOfInterval(
		{ start: parseStrictOrThrow(firstDate, DAY), end: parseStrictOrThrow(lastDate, DAY) },
		IN_OSLO,
	)
		.filter(isTuesdayOrThursdayDate)
		.map((day) => format(day, DAY));
}

/** Whether the day is a Tuesday or a Thursday. */
export function isTuesdayOrThursday(date: string): boolean {
	return isTuesdayOrThursdayDate(parseStrictOrThrow(date, DAY));
}

/** The semester that follows the one running on the given Oslo day. */
export function nextTermAfter(today: string): { year: number; term: SemesterTerm } {
	const day = parseStrictOrThrow(today, DAY);
	const year = day.getFullYear();
	// Months are zero-based: 0–5 are January to June, the spring term.
	return day.getMonth() < 6 ? { year, term: "autumn" } : { year: year + 1, term: "spring" };
}

function isTuesdayOrThursdayDate(day: Date): boolean {
	return isTuesday(day) || isThursday(day);
}

/**
 * Parses an Oslo-local value, accepting it only if it round-trips to the same text. date-fns is
 * lenient on its own ("2027-1-5", "27-01-01"), and a time in the spring-forward gap would shift.
 */
function parseStrict(value: string, pattern: string): Date | null {
	const date = parse(value, pattern, new Date(), IN_OSLO);
	return isValid(date) && format(date, pattern) === value ? date : null;
}

function parseStrictOrThrow(value: string, pattern: string): Date {
	const date = parseStrict(value, pattern);
	if (!date) throw new Error(`Invalid Oslo date or time: ${value}`);
	return date;
}
