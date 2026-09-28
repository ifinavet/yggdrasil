export const DEFAULT_EVENT_DURATION_MS = 4 * 60 * 60 * 1000;

export type CalendarEvent = {
	title: string;
	location: string;
	eventStart: number;
	url: string;
};

export function toCompactUtc(epochMillis: number): string {
	return new Date(epochMillis).toISOString().replaceAll(/-|:|\.\d+/g, "");
}

export function googleCalendarUrl({ title, location, eventStart, url }: CalendarEvent): string {
	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: title,
		dates: `${toCompactUtc(eventStart)}/${toCompactUtc(eventStart + DEFAULT_EVENT_DURATION_MS)}`,
		details: url,
		location,
	});
	return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl({ title, location, eventStart, url }: CalendarEvent): string {
	const params = new URLSearchParams({
		path: "/calendar/action/compose",
		rru: "addevent",
		subject: title,
		startdt: new Date(eventStart).toISOString(),
		enddt: new Date(eventStart + DEFAULT_EVENT_DURATION_MS).toISOString(),
		body: url,
		location,
	});
	return `https://outlook.office.com/calendar/0/deeplink/compose?${params}`;
}
