import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { DATE_PATTERNS, OSLO_TIME_ZONE } from "./constants";

export function formatOsloDate(timestamp: number, pattern: string): string {
	return format(new TZDate(timestamp, OSLO_TIME_ZONE), pattern, { locale: nb });
}

export function formatOsloToday(): string {
	return formatOsloDate(Date.now(), DATE_PATTERNS.numericDate);
}

export const humanReadableDate = (date: Date): string =>
	date.toLocaleDateString("no", {
		weekday: "long",
		month: "short",
		day: "numeric",
		timeZone: OSLO_TIME_ZONE,
	});

export const humanReadableTime = (date: Date): string =>
	date.toLocaleTimeString("no", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: OSLO_TIME_ZONE,
	});

export const humanReadableDateTime = (date: Date): string =>
	date.toLocaleString("no", {
		weekday: "long",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: OSLO_TIME_ZONE,
	});

export const humanReadableFullDateTime = (date: Date): string =>
	date.toLocaleString("no-NO", {
		year: "numeric",
		month: "long",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: OSLO_TIME_ZONE,
	});
