/** Minutes since midnight on an ISO calendar date in Europe/Oslo. */
export type AvailabilityWindow = Readonly<{ day: string; start: number; end: number }>;

export function localWindow(
	at: number,
	durationMinutes: number,
	timeZone: string,
): AvailabilityWindow {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(at);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	const start = Number(value("hour")) * 60 + Number(value("minute"));
	return {
		day: `${value("year")}-${value("month")}-${value("day")}`,
		start,
		end: start + durationMinutes,
	};
}

export function isValidAvailability(windows: readonly AvailabilityWindow[], maxWindows = 112) {
	if (windows.length > maxWindows) return false;
	const sorted = [...windows].sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);
	return sorted.every(
		(window, index) =>
			/^\d{4}-\d{2}-\d{2}$/.test(window.day) &&
			Number.isInteger(window.start) &&
			Number.isInteger(window.end) &&
			window.start >= 0 &&
			window.start < window.end &&
			window.end <= 1440 &&
			(index === 0 ||
				sorted[index - 1]?.day !== window.day ||
				(sorted[index - 1]?.end ?? 0) <= window.start),
	);
}

export function overlaps(a: AvailabilityWindow, b: AvailabilityWindow) {
	return a.day === b.day && a.start < b.end && b.start < a.end;
}

/** Adjacent or overlapping selected blocks form a single available interval. */
export function isAvailable(windows: readonly AvailabilityWindow[], interview: AvailabilityWindow) {
	let coveredUntil = interview.start;
	const ordered = windows
		.filter((window) => window.day === interview.day)
		.sort((a, b) => a.start - b.start);
	for (const window of ordered) {
		if (window.start > coveredUntil) return false;
		coveredUntil = Math.max(coveredUntil, window.end);
		if (coveredUntil >= interview.end) return true;
	}
	return false;
}
