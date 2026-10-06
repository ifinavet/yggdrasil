import { TZDate } from "@date-fns/tz";
import { eachDayOfInterval, format } from "date-fns";
import { MINUTES_PER_DAY, WORKDAYS } from "./constants";
import { formatLocalDate } from "./formatting";
import { isIsoDate } from "./semester";

export type TimeInterval = Readonly<{ start: number; end: number }>;
export type LocalMinuteWindow = TimeInterval & Readonly<{ day: string }>;

export function isValidTimeWindows(windows: readonly LocalMinuteWindow[], maxWindows = Infinity) {
	if (windows.length > maxWindows) return false;
	const sorted = [...windows].sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);
	return sorted.every(
		(window, index) =>
			isIsoDate(window.day) &&
			Number.isInteger(window.start) &&
			Number.isInteger(window.end) &&
			window.start >= 0 &&
			window.start < window.end &&
			window.end <= MINUTES_PER_DAY &&
			(index === 0 ||
				sorted[index - 1]?.day !== window.day ||
				(sorted[index - 1]?.end ?? 0) <= window.start),
	);
}

export function localDateAndMinute(
	timestamp: number,
	timeZone: string,
): Readonly<{ day: string; minute: number }> {
	const [day, clock] = formatLocalDate(timestamp, timeZone, "yyyy-MM-dd HH:mm").split(" ");
	const [hour, minute] = (clock ?? "").split(":").map(Number);
	return { day: day ?? "", minute: (hour ?? 0) * 60 + (minute ?? 0) };
}

export function localWindow(
	timestamp: number,
	durationMinutes: number,
	timeZone: string,
): LocalMinuteWindow {
	const { day, minute } = localDateAndMinute(timestamp, timeZone);
	return { day, start: minute, end: minute + durationMinutes };
}

export function calendarDaysBetween(firstDay: string, lastDay: string, timeZone: string): string[] {
	const [firstYear = 0, firstMonth = 1, firstDate = 1] = firstDay.split("-").map(Number);
	const [lastYear = 0, lastMonth = 1, lastDate = 1] = lastDay.split("-").map(Number);
	const first = new TZDate(firstYear, firstMonth - 1, firstDate, timeZone);
	const last = new TZDate(lastYear, lastMonth - 1, lastDate, timeZone);
	return eachDayOfInterval({ start: first, end: last }).map((date) => format(date, "yyyy-MM-dd"));
}

export function weekdaysBetween(firstDay: string, lastDay: string, timeZone: string): string[] {
	return calendarDaysBetween(firstDay, lastDay, timeZone).filter((day) =>
		WORKDAYS.includes(new Date(`${day}T12:00:00Z`).getUTCDay()),
	);
}

export function overlaps(a: LocalMinuteWindow, b: LocalMinuteWindow): boolean {
	return a.day === b.day && a.start < b.end && b.start < a.end;
}

export function coversWindow(
	windows: readonly LocalMinuteWindow[],
	target: LocalMinuteWindow,
): boolean {
	return coversInterval(
		windows.filter((window) => window.day === target.day),
		target,
	);
}

export function coversInterval(windows: readonly TimeInterval[], target: TimeInterval): boolean {
	let coveredUntil = target.start;
	const ordered = [...windows].sort((a, b) => a.start - b.start);
	for (const window of ordered) {
		if (window.start > coveredUntil) return false;
		coveredUntil = Math.max(coveredUntil, window.end);
		if (coveredUntil >= target.end) return true;
	}
	return false;
}
