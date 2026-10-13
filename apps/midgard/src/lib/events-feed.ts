import { osloMonthName } from "@workspace/shared/time";

export function splitUpcomingPast<T extends { eventStart: number }>(
	events: T[],
	now: number,
): { upcoming: T[]; past: T[] } {
	const upcoming = events
		.filter((e) => e.eventStart >= now)
		.sort((a, b) => a.eventStart - b.eventStart);
	const past = events.filter((e) => e.eventStart < now).sort((a, b) => b.eventStart - a.eventStart);
	return { upcoming, past };
}

export function nextEventMonth<T extends { eventStart: number }>(
	eventsByMonth: Record<string, T[]>,
	now: number,
): string | undefined {
	const next = Object.values(eventsByMonth)
		.flat()
		.filter((e) => e.eventStart >= now)
		.sort((a, b) => a.eventStart - b.eventStart)[0];
	return next && osloMonthName(next.eventStart);
}
