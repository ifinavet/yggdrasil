const OSLO_DATE_FORMAT = new Intl.DateTimeFormat("nb-NO", {
	timeZone: "Europe/Oslo",
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

const OSLO_MONTH_NUMBER_FORMAT = new Intl.DateTimeFormat("en-US", {
	timeZone: "Europe/Oslo",
	month: "numeric",
});

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

export function osloDateParts(timestamp: number) {
	const parts = Object.fromEntries(
		OSLO_DATE_FORMAT.formatToParts(timestamp).map((part) => [part.type, part.value]),
	);
	return {
		weekday: parts.weekday ?? "",
		day: Number(parts.day),
		month: parts.month ?? "",
		monthNumber: Number(OSLO_MONTH_NUMBER_FORMAT.format(timestamp)),
		year: Number(parts.year),
		time: `${parts.hour}:${parts.minute}`,
	};
}

export function monthLabel(timestamp: number): string {
	return capitalize(osloDateParts(timestamp).month);
}

export function shortDate(timestamp: number): string {
	const { day, month } = osloDateParts(timestamp);
	return `${day}. ${month.slice(0, 3)}`;
}

export function timeOfDay(timestamp: number): string {
	return osloDateParts(timestamp).time;
}

export function longDate(timestamp: number): string {
	const { weekday, day, month, time } = osloDateParts(timestamp);
	return `${capitalize(weekday)} ${day}. ${month}, ${time}`;
}
