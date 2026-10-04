/** Minutes since midnight on an ISO calendar date in Europe/Oslo. */
export type AvailabilityWindow = Readonly<{ day: string; start: number; end: number }>;

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
