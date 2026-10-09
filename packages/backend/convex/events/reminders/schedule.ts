import { DAY_MS } from "@workspace/shared/time";

export const REMINDER_KINDS = ["week", "twoDays"] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REVIEWED_REMINDER_KIND = "twoDays" satisfies ReminderKind;

export const REMINDER_LEAD_TIMES = {
	week: 7 * DAY_MS,
	twoDays: 2 * DAY_MS,
} as const satisfies Record<ReminderKind, number>;

export function reminderPlanned(kind: ReminderKind) {
	return kind === REVIEWED_REMINDER_KIND;
}
