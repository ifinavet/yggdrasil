import { TZDate } from "@date-fns/tz";
import { addDays, format, set, subMonths } from "date-fns";
import { nb } from "date-fns/locale";

const OSLO = "Europe/Oslo";

function osloMorning(date: TZDate): number {
	return set(date, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }).getTime();
}

/** One calendar month before the event at 09:00 in Oslo. */
export function channelOpensAt(eventStart: number): number {
	return osloMorning(subMonths(new TZDate(eventStart, OSLO), 1));
}

/** Fallback when no feedback form is sent: three calendar days after the event. */
export function channelArchiveDeadline(eventStart: number): number {
	return addDays(new TZDate(eventStart, OSLO), 3).getTime();
}

/** 09:00 in Oslo the given number of calendar days before the event. */
export function daysBeforeAt(eventStart: number, days: number): number {
	return osloMorning(addDays(new TZDate(eventStart, OSLO), -days));
}

/** For example "torsdag 22. oktober kl. 16:15". */
export function formatEventStart(eventStart: number): string {
	return format(new TZDate(eventStart, OSLO), "EEEE d. MMMM 'kl.' HH:mm", { locale: nb });
}

/** Oslo calendar date as yyyy-MM-dd. */
export function formatEventDate(eventStart: number): string {
	return format(new TZDate(eventStart, OSLO), "yyyy-MM-dd");
}
