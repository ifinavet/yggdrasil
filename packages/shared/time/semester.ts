import { TZDate, tz } from "@date-fns/tz";
import { eachDayOfInterval, format, isThursday, isTuesday, isValid, parse } from "date-fns";
import { nb } from "date-fns/locale";
import { AUTUMN_FIRST_MONTH, OSLO_TIME_ZONE } from "./constants";
import { formatLocalDate } from "./formatting";

// Semester days are Oslo-local "YYYY-MM-DD" strings. All parsing and calendar arithmetic runs in
// the Oslo time zone, so weekdays and wall-clock times stay right across daylight-saving changes.

const IN_OSLO = { in: tz(OSLO_TIME_ZONE) };
const DAY_FORMAT = "yyyy-MM-dd";
const TIME_FORMAT = "HH:mm";

export const SEMESTER_TERMS = ["spring", "autumn"] as const;
export type SemesterTerm = (typeof SEMESTER_TERMS)[number];

/** A semester named by its year and term, like «Våren 2027». */
export type SemesterRef = { year: number; term: SemesterTerm };

/** Whether the value is a real calendar day written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
	return parseStrict(value, DAY_FORMAT) !== null;
}

/** Whether the value is a wall-clock time written as HH:mm, like "16:15". */
export function isClockTime(value: string): boolean {
	return parseStrict(value, TIME_FORMAT) !== null;
}

/** Today's calendar day in Oslo. */
export function osloToday(now: number): string {
	return osloClock(now).slice(0, DAY_FORMAT.length);
}

const OSLO_CLOCK = new Intl.DateTimeFormat("sv-SE", {
	timeZone: OSLO_TIME_ZONE,
	dateStyle: "short",
	timeStyle: "short",
});

/** The Oslo wall-clock time of a moment, as "YYYY-MM-DD HH:mm". */
function osloClock(epoch: number): string {
	return OSLO_CLOCK.format(epoch);
}

type Clock = [year: number, month: number, day: number, hours: number, minutes: number];

function fromLocalClock(value: string, timeZone: string): number {
	const [year, month, day, hours, minutes] = value.split(/[- :]/).map(Number) as Clock;
	return new TZDate(year, month - 1, day, hours, minutes, timeZone).getTime();
}

export function localDateTimeToEpoch(date: string, time: string, timeZone: string): number {
	const value = `${date} ${time}`;
	const epoch = fromLocalClock(value, timeZone);
	if (Number.isNaN(epoch) || formatLocalDate(epoch, timeZone, "yyyy-MM-dd HH:mm") !== value) {
		throw new Error(`Invalid local date or time (${timeZone}): ${value}`);
	}
	return epoch;
}

export function osloDateTimeToEpoch(date: string, time: string): number {
	return localDateTimeToEpoch(date, time, OSLO_TIME_ZONE);
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
	/** "tir 9. feb." */
	short: "EEE d. MMM",
	/** "tirsdag 9. februar 2027" */
	long: "PPPP",
	/** "tirsdag 9. februar", inside the semester where the year goes without saying */
	longNoYear: "EEEE d. MMMM",
	/** "tir 9.", under a month heading */
	weekdayDay: "EEE d.",
	/** "ti", for narrow calendar headers */
	weekdayMin: "EEEEEE",
	/** "februar" */
	month: "LLLL",
	/** "feb." */
	monthShort: "LLL",
} as const;

/** A semester day for people, in Norwegian, in one of the styles above. */
export function formatSemesterDay(date: string, style: keyof typeof DAY_STYLES = "short"): string {
	return format(parseStrictOrThrow(date, DAY_FORMAT), DAY_STYLES[style], {
		...IN_OSLO,
		locale: nb,
	});
}

/** The term an Oslo day belongs to, and its year. */
export function termOfDay(date: string): SemesterRef {
	const day = parseStrictOrThrow(date, DAY_FORMAT);
	return {
		year: day.getFullYear(),
		term: day.getMonth() < AUTUMN_FIRST_MONTH ? "spring" : "autumn",
	};
}

/** The semester after the given one: autumn follows spring, and next year's spring follows autumn. */
export function termAfter({ year, term }: SemesterRef): SemesterRef {
	return term === "spring" ? { year, term: "autumn" } : { year: year + 1, term: "spring" };
}

/** The semester that follows the one running on the given Oslo day. */
export function nextTermAfter(today: string): SemesterRef {
	return termAfter(termOfDay(today));
}

/** Orders semesters in time: spring comes before autumn in the same year. */
export function semesterSortKey({ year, term }: SemesterRef): number {
	return year * 2 + (term === "autumn" ? 1 : 0);
}

/** A comparator for sorting semesters earliest first. */
export function compareSemesters(a: SemesterRef, b: SemesterRef): number {
	return semesterSortKey(a) - semesterSortKey(b);
}

export function isSameSemester(a: SemesterRef, b: SemesterRef): boolean {
	return a.year === b.year && a.term === b.term;
}

/**
 * The semester a company most likely applies for on the given Oslo day: the one after the running
 * semester when it is among the choices, else the earliest choice from the running semester on,
 * else the latest choice (a late application for the running semester). Null with no choices.
 */
export function defaultApplicationSemester<T extends SemesterRef>(
	today: string,
	choices: readonly T[],
): T | null {
	const sorted = [...choices].sort(compareSemesters);
	const current = semesterSortKey(termOfDay(today));
	const next = semesterSortKey(nextTermAfter(today));
	return (
		sorted.find((choice) => semesterSortKey(choice) === next) ??
		sorted.find((choice) => semesterSortKey(choice) >= current) ??
		sorted.at(-1) ??
		null
	);
}

// How far ahead a suggested semester may be. Well beyond what anyone plans.
const MAX_TERMS_AHEAD = 20;

/**
 * The first semester, from the one running on the given Oslo day, that is not among the existing
 * ones. Suggested when creating a semester, so the suggestion never clashes with one that exists.
 */
export function firstMissingTerm(today: string, existing: readonly SemesterRef[]): SemesterRef {
	let candidate = termOfDay(today);
	for (let step = 0; step < MAX_TERMS_AHEAD; step++) {
		if (!existing.some((semester) => isSameSemester(semester, candidate))) return candidate;
		candidate = termAfter(candidate);
	}
	return candidate;
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
