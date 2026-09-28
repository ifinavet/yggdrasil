import { formatDistanceStrict } from "date-fns";
import { nb } from "date-fns/locale";

export const LOW_SPOTS_THRESHOLD = 10;

export function spotsLabel(registeredCount: number, availableSpots: number): string {
	const spots = `${availableSpots} ${availableSpots === 1 ? "plass" : "plasser"} igjen`;
	const isLow = availableSpots > 0 && availableSpots <= LOW_SPOTS_THRESHOLD;
	return `${registeredCount} påmeldt, ${isLow ? `bare ${spots}!` : spots}`;
}

export function countdownLabel(eventStart: number, now: number): string | null {
	if (eventStart <= now) return null;
	return formatDistanceStrict(eventStart, now, { addSuffix: true, locale: nb });
}
