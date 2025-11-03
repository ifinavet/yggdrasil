export const humanReadableDate = (date: Date): string =>
	date.toLocaleDateString("no", {
		weekday: "long",
		month: "short",
		day: "numeric",
		timeZone: "Europe/Oslo",
	});

export const humanReadableTime = (date: Date): string =>
	date.toLocaleTimeString("no", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Oslo",
	});

export const humanReadableDateTime = (date: Date): string =>
	date.toLocaleString("no", {
		weekday: "long",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Oslo",
	});
