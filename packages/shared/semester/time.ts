import { TZDate, tz } from "@date-fns/tz";
import { eachDayOfInterval, format, isThursday, isTuesday, isValid, parse } from "date-fns";
import { nb } from "date-fns/locale";

// Semester days are Oslo-local "YYYY-MM-DD" strings. All parsing and calendar arithmetic runs in
// the Oslo time zone, so weekdays and wall-clock times stay right across daylight-saving changes.

const OSLO = "Europe/Oslo";
const IN_OSLO = { in: tz(OSLO) };
const DAY_FORMAT = "yyyy-MM-dd";

/** First month of the autumn term, zero-based (July). January to June belongs to spring. */
const AUTUMN_FIRST_MONTH = 6;

export const SEMESTER_TERMS = ["spring", "autumn"] as const;
export type SemesterTerm = (typeof SEMESTER_TERMS)[number];

/** Whether the value is a real calendar day written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
	return parseStrict(value, DAY_FORMAT) !== null;
}

/** Today's calendar day in Oslo. */
export function osloToday(now: number): string {
	return osloClock(now).slice(0, DAY_FORMAT.length);
}

// In the Convex runtime, date-fns's `in` option reads a moment in UTC, not Oslo. Intl and TZDates
// built from wall-clock parts work there, so moments are converted with those.
const OSLO_CLOCK = new Intl.DateTimeFormat("sv-SE", {
	timeZone: OSLO,
	dateStyle: "short",
	timeStyle: "short",
});

/** The Oslo wall-clock time of a moment, as "YYYY-MM-DD HH:mm". */
function osloClock(epoch: number): string {
	return OSLO_CLOCK.format(epoch);
}

type Clock = [year: number, month: number, day: number, hours: number, minutes: number];

/** The moment an Oslo "YYYY-MM-DD HH:mm" happens, moved by a number of days. */
function fromOsloClock(value: string, addDays = 0): number {
	const [year, month, day, hours, minutes] = value.split(/[- :]/).map(Number) as Clock;
	return new TZDate(year, month - 1, day + addDays, hours, minutes, OSLO).getTime();
}

/**
 * An Oslo-local day and "HH:mm" time as epoch milliseconds, across daylight-saving changes. A value
 * that does not come back the same, like "9:00" or a time skipped when summer time starts, is refused.
 */
export function osloDateTimeToEpoch(date: string, time: string): number {
	const value = `${date} ${time}`;
	const epoch = fromOsloClock(value);
	if (Number.isNaN(epoch) || osloClock(epoch) !== value) {
		throw new Error(`Invalid Oslo date or time: ${value}`);
	}
	return epoch;
}

/** The moment a number of Oslo calendar days after another, keeping the wall-clock time. */
export function addOsloDays(epoch: number, days: number): number {
	return fromOsloClock(osloClock(epoch), days);
}

/** Every presentation day (Tuesday and Thursday) from firstDate to lastDate, both inclusive. */
export function presentationDaysBetween(firstDate: string, lastDate: string): string[] {
	return eachDayOfInterval(
		{
			start: parseStrictOrThrow(firstDate, DAY_FORMAT),
			end: parseStrictOrThrow(lastDate, DAY_FORMAT),
		},
		IN_OSLO,
	)
		.filter(isPresentationWeekday)
		.map((day) => format(day, DAY_FORMAT));
}

// date-fns patterns for showing a semester day. "PPPP" is the locale's full date format.
const DAY_STYLES = {
	short: "EEE d. MMM",
	long: "PPPP",
	weekday: "EEEE",
	shortNumeric: "d.MM",
} as const;

/**
 * A semester day for people, in Norwegian: "tir 9. feb." (short), "tirsdag 9. februar 2027"
 * (long), "tirsdag" (weekday) or "9.02" (shortNumeric, as in the Excel plan).
 */
export function formatSemesterDay(date: string, style: keyof typeof DAY_STYLES = "short"): string {
	return format(parseStrictOrThrow(date, DAY_FORMAT), DAY_STYLES[style], {
		...IN_OSLO,
		locale: nb,
	});
}

/** Whether the day is a presentation day: a Tuesday or a Thursday. */
export function isPresentationDay(date: string): boolean {
	return isPresentationWeekday(parseStrictOrThrow(date, DAY_FORMAT));
}

/** The term an Oslo day belongs to, and its year. */
export function termOfDay(date: string): { year: number; term: SemesterTerm } {
	const day = parseStrictOrThrow(date, DAY_FORMAT);
	return {
		year: day.getFullYear(),
		term: day.getMonth() < AUTUMN_FIRST_MONTH ? "spring" : "autumn",
	};
}

/** The semester that follows the one running on the given Oslo day. */
export function nextTermAfter(today: string): { year: number; term: SemesterTerm } {
	const { year, term } = termOfDay(today);
	return term === "spring" ? { year, term: "autumn" } : { year: year + 1, term: "spring" };
}

function isPresentationWeekday(day: Date): boolean {
	return isTuesday(day) || isThursday(day);
}

/**
 * Parses an Oslo-local value, accepting it only if it round-trips to the same text. date-fns is
 * lenient on its own ("2027-1-5", "27-01-01").
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
