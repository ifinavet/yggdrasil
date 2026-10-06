import { formatDistanceStrict } from "date-fns";
import { nb } from "date-fns/locale";

export const LOW_SPOTS_THRESHOLD = 10;

export function spotsLabel(registeredCount: number, availableSpots: number): string {
	const registered = `${registeredCount} påmeldt`;
	if (availableSpots === 0) return registered;
	const spots = `${availableSpots} ${availableSpots === 1 ? "plass" : "plasser"} igjen`;
	const isLow = availableSpots <= LOW_SPOTS_THRESHOLD;
	const availability = isLow ? `bare ${spots}!` : spots;
	return `${registered}, ${availability}`;
}

export function countdownLabel(eventStart: number, now: number): string | null {
	if (eventStart <= now) return null;
	return formatDistanceStrict(eventStart, now, { addSuffix: true, locale: nb });
}
