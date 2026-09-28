import { DAY_MS } from "@workspace/shared/time";

export const REMINDER_KINDS = ["week", "twoDays"] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_LEAD_TIMES = {
	week: 7 * DAY_MS,
	twoDays: 2 * DAY_MS,
} as const satisfies Record<ReminderKind, number>;

export function dueReminder(eventStart: number, now: number): ReminderKind | null {
	const timeLeft = eventStart - now;
	if (timeLeft <= 0) return null;
	if (timeLeft <= REMINDER_LEAD_TIMES.twoDays) return "twoDays";
	if (timeLeft <= REMINDER_LEAD_TIMES.week) return "week";
	return null;
}
