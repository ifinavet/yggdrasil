import { directoryUrl, type GoogleConfig } from "./config";
import { googleAccessToken } from "./google";

const API = "https://www.googleapis.com/calendar/v3";
const DEFAULT_SCOPES = [
	"https://www.googleapis.com/auth/calendar.events",
	"https://www.googleapis.com/auth/calendar.calendarlist.readonly",
	"https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

export function googleCalendarScope() {
	const scopes = process.env.GOOGLE_CALENDAR_SCOPES?.trim();
	return scopes || DEFAULT_SCOPES;
}

export class GoogleCalendarError extends Error {}

type Calendar = Readonly<{ id: string; summary?: string; primary?: boolean }>;
type Busy = Readonly<{ start: string; end: string }>;
export type CalendarEvent = Readonly<{
	id: string;
	iCalUID?: string;
	status?: string;
	transparency?: string;
	extendedProperties?: { shared?: Record<string, string> };
	start?: { dateTime?: string; date?: string };
	end?: { dateTime?: string; date?: string };
}>;

export type BusyInterval = Readonly<{ start: number; end: number }>;

function eventTime(value: { dateTime?: string; date?: string } | undefined) {
	const raw = value?.dateTime ?? (value?.date ? `${value.date}T00:00:00Z` : undefined);
	const time = raw ? Date.parse(raw) : Number.NaN;
	if (!Number.isFinite(time))
		throw new GoogleCalendarError("Google Calendar returnerte en ugyldig hendelsestid.");
	return time;
}

export function externalBusyIntervals(
	events: readonly CalendarEvent[],
	ownInterviewId?: string | ReadonlySet<string>,
	ownPeriodId?: string,
) {
	return events.flatMap((event): BusyInterval[] => {
		const markedInterviewId = event.extendedProperties?.shared?.navetAdmissionsInterviewId;
		const isOwnInterview =
			markedInterviewId !== undefined &&
			(typeof ownInterviewId === "string"
				? markedInterviewId === ownInterviewId &&
					(event.extendedProperties?.shared?.navetAdmissionsPeriodId === ownPeriodId ||
						ownPeriodId === undefined)
				: ownInterviewId?.has(markedInterviewId) === true &&
					(event.extendedProperties?.shared?.navetAdmissionsPeriodId === ownPeriodId ||
						ownPeriodId === undefined));
		if (event.status === "cancelled" || event.transparency === "transparent" || isOwnInterview)
			return [];
		const start = eventTime(event.start);
		const end = eventTime(event.end);
		if (end <= start)
			throw new GoogleCalendarError("Google Calendar returnerte en ugyldig hendelse.");
		return [{ start, end }];
	});
}

export function overlapsBusy(interval: BusyInterval, start: number, end: number) {
	return interval.start < end && start < interval.end;
}

async function error(response: Response, action: string): Promise<never> {
	const body: unknown = await response.json().catch(() => null);
	const detail =
		body &&
		typeof body === "object" &&
		"error" in body &&
		body.error &&
		typeof body.error === "object" &&
		"message" in body.error &&
		typeof body.error.message === "string"
			? body.error.message.replaceAll(/\s+/g, " ").slice(0, 500)
			: "";
	throw new GoogleCalendarError(
		[`Google Calendar svarte ${response.status} ${action}.`, detail].filter(Boolean).join(" "),
	);
}

export function googleCalendarClient(config: GoogleConfig, subject: string) {
	let token: Promise<string> | undefined;
	const accessToken = () => (token ??= googleAccessToken(config, subject, googleCalendarScope()));
	async function call(path: string, init: RequestInit = {}) {
		const response = await fetch(directoryUrl(`${API}${path}`), {
			...init,
			headers: {
				Authorization: `Bearer ${await accessToken()}`,
				"Content-Type": "application/json",
				...init.headers,
			},
			signal: AbortSignal.timeout(15_000),
		});
		return response;
	}

	return {
		async listCalendars(): Promise<Calendar[]> {
			const calendars: Calendar[] = [];
			let pageToken: string | undefined;
			for (let page = 0; page < 20; page++) {
				const params = new URLSearchParams({ maxResults: "250" });
				if (pageToken) params.set("pageToken", pageToken);
				const response = await call(`/users/me/calendarList?${params}`);
				if (!response.ok) return error(response, "kunne ikke lese kalenderlisten");
				const body = (await response.json()) as {
					items?: Calendar[];
					nextPageToken?: string;
				};
				calendars.push(...(body.items ?? []));
				pageToken = body.nextPageToken;
				if (!pageToken) return calendars;
			}
			throw new GoogleCalendarError("Google Calendar returnerte for mange kalendere.");
		},

		async freeBusy(calendarIds: string[], timeMin: string, timeMax: string) {
			if (!calendarIds.length)
				throw new GoogleCalendarError("Velg minst én kalender per intervjuer.");
			const response = await call("/freeBusy", {
				method: "POST",
				body: JSON.stringify({
					timeMin,
					timeMax,
					timeZone: "Europe/Oslo",
					items: calendarIds.map((id) => ({ id })),
				}),
			});
			if (!response.ok) return error(response, "kunne ikke lese opptattstatus");
			const body = (await response.json()) as {
				calendars?: Record<string, { busy?: Busy[]; errors?: { reason?: string }[] }>;
			};
			for (const id of calendarIds) {
				const calendar = body.calendars?.[id];
				if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
					throw new GoogleCalendarError(
						"En valgt Google-kalender kan ikke leses. Kontroller kalenderens tilgang.",
					);
				}
			}
			return body.calendars;
		},

		async listEvents(
			calendarId: string,
			timeMin: string,
			timeMax: string,
		): Promise<CalendarEvent[]> {
			const events: CalendarEvent[] = [];
			let pageToken: string | undefined;
			for (let page = 0; page < 20; page++) {
				const params = new URLSearchParams({
					timeMin,
					timeMax,
					singleEvents: "true",
					showDeleted: "false",
					maxResults: "2500",
					fields:
						"items(id,iCalUID,status,transparency,start,end,extendedProperties),nextPageToken",
				});
				if (pageToken) params.set("pageToken", pageToken);
				const response = await call(
					`/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
				);
				if (!response.ok) return error(response, "kunne ikke lese kalenderhendelser");
				const body = (await response.json()) as {
					items?: CalendarEvent[];
					nextPageToken?: string;
				};
				events.push(...(body.items ?? []));
				pageToken = body.nextPageToken;
				if (!pageToken) return events;
			}
			throw new GoogleCalendarError("Google Calendar returnerte for mange hendelser.");
		},

		async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent | null> {
			const response = await call(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
			if (response.status === 404 || response.status === 410) return null;
			if (!response.ok) return error(response, "kunne ikke hente intervjuet");
			return (await response.json()) as CalendarEvent;
		},

		async upsertEvent(calendarId: string, eventId: string, event: Record<string, unknown>) {
			if (!/^[a-v0-9]{5,1024}$/.test(eventId))
				throw new GoogleCalendarError("Ugyldig stabil Google Calendar event-id.");
			const path = `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=all`;
			const update = await call(path, { method: "PUT", body: JSON.stringify(event) });
			if (update.ok) return eventId;
			if (update.status !== 404) return error(update, "kunne ikke oppdatere intervjuet");
			const create = await call(
				`/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
				{
					method: "POST",
					body: JSON.stringify({ ...event, id: eventId }),
				},
			);
			if (create.ok || create.status === 409) return eventId;
			return error(create, "kunne ikke opprette intervjuet");
		},

		async cancelEvent(calendarId: string, eventId: string) {
			const response = await call(
				`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=all`,
				{ method: "DELETE" },
			);
			if (!response.ok && response.status !== 404 && response.status !== 410)
				return error(response, "kunne ikke avlyse intervjuet");
		},
	};
}
