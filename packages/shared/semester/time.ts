import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

// Semester days are Oslo-local "YYYY-MM-DD" strings. Calendar arithmetic on them is done in UTC,
// which has no daylight-saving gaps, so a Tuesday stays a Tuesday.

const OSLO = "Europe/Oslo";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_IN_MS = 86_400_000;
const TUESDAY = 2;
const THURSDAY = 4;

export type SemesterTerm = "spring" | "autumn";

/** Whether the value is a real calendar day written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
	return parseIsoDate(value) !== null;
}

/** Today's calendar day in Oslo. */
export function osloToday(now: number): string {
	return format(new TZDate(now, OSLO), "yyyy-MM-dd");
}

/** An Oslo-local day and "HH:mm" time as epoch milliseconds, across daylight-saving changes. */
export function osloDateTimeToEpoch(date: string, time: string): number {
	const day = parseIsoDate(date);
	const clock = TIME.exec(time);
	if (!day || !clock) throw new Error(`Invalid Oslo date or time: ${date} ${time}`);

	const [year, month, dayOfMonth] = day;
	return new TZDate(
		year,
		month - 1,
		dayOfMonth,
		Number(clock[1]),
		Number(clock[2]),
		OSLO,
	).getTime();
}

/** Every Tuesday and Thursday from firstDate to lastDate, both inclusive. */
export function tuesdaysAndThursdays(firstDate: string, lastDate: string): string[] {
	const days: string[] = [];
	for (let time = toUtc(firstDate); time <= toUtc(lastDate); time += DAY_IN_MS) {
		const weekday = new Date(time).getUTCDay();
		if (weekday === TUESDAY || weekday === THURSDAY) days.push(fromUtc(time));
	}
	return days;
}

/** Whether the day is a Tuesday or a Thursday. */
export function isTuesdayOrThursday(date: string): boolean {
	const weekday = new Date(toUtc(date)).getUTCDay();
	return weekday === TUESDAY || weekday === THURSDAY;
}

/** The semester that follows the one running on the given Oslo day. */
export function nextTermAfter(today: string): { year: number; term: SemesterTerm } {
	const [year, month] = parseIsoDateOrThrow(today);
	return month <= 6 ? { year, term: "autumn" } : { year: year + 1, term: "spring" };
}

function parseIsoDate(value: string): [number, number, number] | null {
	const match = ISO_DATE.exec(value);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	const isRealDay =
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

	return isRealDay ? [year, month, day] : null;
}

function parseIsoDateOrThrow(value: string): [number, number, number] {
	const parsed = parseIsoDate(value);
	if (!parsed) throw new Error(`Invalid date: ${value}`);
	return parsed;
}

function toUtc(date: string): number {
	const [year, month, day] = parseIsoDateOrThrow(date);
	return Date.UTC(year, month - 1, day);
}

function fromUtc(time: number): string {
	return new Date(time).toISOString().slice(0, 10);
}
