import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, set } from "date-fns";
import { OSLO_TIME_ZONE } from "./constants";

export const REMINDER_DAYS = [3, 7, 11] as const;

/** Next calendar day at 08:00 in Oslo, including daylight-saving transitions. */
export function feedbackOpensAt(eventStart: number): number {
	return set(addDays(new TZDate(eventStart, OSLO_TIME_ZONE), 1), {
		hours: 8,
		minutes: 0,
		seconds: 0,
		milliseconds: 0,
	}).getTime();
}

/** Eighteen UTC calendar months, clamped to the last day of the target month. */
export function feedbackRetentionAt(closedAt: number): number {
	return addMonths(new TZDate(closedAt, "UTC"), 18).getTime();
}

/** Keeps reminders and closure at the same Oslo time when daylight saving changes. */
export function feedbackRoundAt(opensAt: number, days: number): number {
	return addDays(new TZDate(opensAt, OSLO_TIME_ZONE), days).getTime();
}
