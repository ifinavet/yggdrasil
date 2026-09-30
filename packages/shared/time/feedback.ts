import { TZDate } from "@date-fns/tz";
import { addMonths } from "date-fns";
import { DAY_MS } from "./constants";
import { formatOsloDate } from "./formatting";
import { osloDateTimeToEpoch, osloToday } from "./semester";

function calendarDayAfter(timestamp: number, days: number) {
	return new Date(Date.parse(osloToday(timestamp)) + days * DAY_MS).toISOString().slice(0, 10);
}

export const REMINDER_DAYS = [3, 7, 11] as const;

/** Next calendar day at 08:00 in Oslo, including daylight-saving transitions. */
export function feedbackOpensAt(eventStart: number): number {
	return osloDateTimeToEpoch(calendarDayAfter(eventStart, 1), "08:00");
}

/** Eighteen UTC calendar months, clamped to the last day of the target month. */
export function feedbackRetentionAt(closedAt: number): number {
	return addMonths(new TZDate(closedAt, "UTC"), 18).getTime();
}

/** Keeps reminders and closure at the same Oslo time when daylight saving changes. */
export function feedbackRoundAt(opensAt: number, days: number): number {
	return (
		osloDateTimeToEpoch(calendarDayAfter(opensAt, days), formatOsloDate(opensAt, "HH:mm")) +
		(opensAt % 60_000)
	);
}
