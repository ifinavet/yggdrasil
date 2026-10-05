import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { DATE_PATTERNS, OSLO_TIME_ZONE } from "./constants";

const OSLO_WALL_CLOCK = new Intl.DateTimeFormat("en-US", {
	timeZone: OSLO_TIME_ZONE,
	hourCycle: "h23",
	year: "numeric",
	month: "numeric",
	day: "numeric",
	hour: "numeric",
	minute: "numeric",
	second: "numeric",
});

function localWallClock(timestamp: number, timeZone: string) {
	const parts = new Map(
		(timeZone === OSLO_TIME_ZONE
			? OSLO_WALL_CLOCK
			: new Intl.DateTimeFormat("en-US", {
					timeZone,
					hourCycle: "h23",
					year: "numeric",
					month: "numeric",
					day: "numeric",
					hour: "numeric",
					minute: "numeric",
					second: "numeric",
				})
		)
			.formatToParts(timestamp)
			.map(({ type, value }) => [type, Number(value)]),
	);
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) as number;
	return new TZDate(
		part("year"),
		part("month") - 1,
		part("day"),
		part("hour"),
		part("minute"),
		part("second"),
		new Date(timestamp).getUTCMilliseconds(),
		"UTC",
	);
}

export function formatLocalDate(timestamp: number, timeZone: string, pattern: string): string {
	return format(localWallClock(timestamp, timeZone), pattern, { locale: nb });
}

export function formatOsloDate(timestamp: number, pattern: string): string {
	return formatLocalDate(timestamp, OSLO_TIME_ZONE, pattern);
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
