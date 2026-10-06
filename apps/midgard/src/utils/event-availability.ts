import { formatDistanceStrict } from "date-fns";
import { nb } from "date-fns/locale";

export function spotsLabel(registeredCount: number, availableSpots: number): string {
	if (availableSpots === 0) return `${registeredCount} påmeldt`;
	return `${availableSpots} ${availableSpots === 1 ? "plass" : "plasser"} igjen`;
}

export function countdownLabel(eventStart: number, now: number): string | null {
	if (eventStart <= now) return null;
	return formatDistanceStrict(eventStart, now, { addSuffix: true, locale: nb });
}
