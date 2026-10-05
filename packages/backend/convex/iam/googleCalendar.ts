"use node";

import { calendar, type calendar_v3 } from "@googleapis/calendar";
import {
	GOOGLE_CALENDAR_API_URL,
	GOOGLE_CALENDAR_DEFAULT_SCOPES,
} from "@workspace/shared/constants";
import { coversInterval } from "@workspace/shared/time";
import { sha256 } from "../lib/tokens";
import { directoryUrl, type GoogleConfig } from "./config";
import { googleAuth } from "./google";

const TIMEOUT_MS = 15_000;
const MAX_PAGES = 20;

export function googleCalendarScope() {
	const scopes = process.env.GOOGLE_CALENDAR_SCOPES?.trim();
	return scopes || GOOGLE_CALENDAR_DEFAULT_SCOPES;
}

export class GoogleCalendarError extends Error {}

type Calendar = calendar_v3.Schema$CalendarListEntry & { id: string };
type Busy = Readonly<{ start: string; end: string }>;
export type CalendarEvent = calendar_v3.Schema$Event & { id: string };

export type BusyInterval = Readonly<{ start: number; end: number }>;
export type OwnedAdmissionEvent = Readonly<{
	eventId: string;
	interviewId: string;
	periodId: string;
}>;

function isOwnedAdmissionEvent(
	event: CalendarEvent,
	ownedEvents: ReadonlyMap<string, OwnedAdmissionEvent> | undefined,
) {
	const interviewId = event.extendedProperties?.shared?.navetAdmissionsInterviewId;
	if (!interviewId) return false;
	const owner = ownedEvents?.get(interviewId);
	return (
		owner?.eventId === event.id &&
		owner?.periodId === event.extendedProperties?.shared?.navetAdmissionsPeriodId
	);
}

function eventBusyInterval(event: CalendarEvent): BusyInterval {
	const start = eventTime(event.start);
	const end = eventTime(event.end);
	if (end <= start)
		throw new GoogleCalendarError("Google Calendar returnerte en ugyldig hendelse.");
	return { start, end };
}

function eventTime(value: calendar_v3.Schema$EventDateTime | undefined) {
	const raw = value?.dateTime ?? (value?.date ? `${value.date}T00:00:00Z` : undefined);
	const time = raw ? Date.parse(raw) : Number.NaN;
	if (!Number.isFinite(time))
		throw new GoogleCalendarError("Google Calendar returnerte en ugyldig hendelsestid.");
	return time;
}

export function externalBusyIntervals(
	events: readonly CalendarEvent[],
	ownedEvents?: ReadonlyMap<string, OwnedAdmissionEvent>,
) {
	return events.flatMap((event): BusyInterval[] => {
		if (
			event.status === "cancelled" ||
			event.transparency === "transparent" ||
			isOwnedAdmissionEvent(event, ownedEvents)
		)
			return [];
		return [eventBusyInterval(event)];
	});
}

export async function readExternalBusy(
	client: Pick<ReturnType<typeof googleCalendarClient>, "freeBusy" | "listEvents">,
	calendarIds: string[],
	timeMin: string,
	timeMax: string,
	ownedEvents: ReadonlyMap<string, OwnedAdmissionEvent>,
): Promise<BusyInterval[][]> {
	const calendars = await client.freeBusy(calendarIds, timeMin, timeMax);
	return Promise.all(
		calendarIds.map(async (calendarId) => {
			const busy = calendars[calendarId]?.busy;
			if (!busy)
				throw new GoogleCalendarError(
					"En valgt Google-kalender kan ikke leses. Kontroller kalenderens tilgang.",
				);
			if (!busy.length) return [];
			const events = await client.listEvents(calendarId, timeMin, timeMax);
			const external = externalBusyIntervals(events, ownedEvents);
			const known = externalBusyIntervals(events);
			if (
				busy.some((entry) => {
					const interval = { start: Date.parse(entry.start), end: Date.parse(entry.end) };
					return (
						!Number.isFinite(interval.start) ||
						!Number.isFinite(interval.end) ||
						interval.end <= interval.start ||
						!coversInterval(known, interval)
					);
				})
			)
				throw new GoogleCalendarError(
					"En valgt Google-kalender har opptattstatus som ikke kan kontrolleres.",
				);
			return external;
		}),
	);
}

export function overlapsBusy(interval: BusyInterval, start: number, end: number) {
	return interval.start < end && start < interval.end;
}

function statusCode(error: unknown): number | undefined {
	if (!error || typeof error !== "object") return;
	const candidate = error as { code?: unknown; response?: { status?: unknown } };
	if (typeof candidate.response?.status === "number") return candidate.response.status;
	return typeof candidate.code === "number" ? candidate.code : undefined;
}

function apiError(error: unknown, action: string): GoogleCalendarError {
	const status = statusCode(error);
	return new GoogleCalendarError(
		status
			? `Google Calendar svarte ${status} ${action}.`
			: `Google Calendar feilet da tjenesten forsøkte å ${action}.`,
	);
}

export function googleCalendarClient(config: GoogleConfig, subject: string) {
	const auth = googleAuth(config, subject, googleCalendarScope());
	const client = calendar({
		version: "v3",
		auth,
		rootUrl: directoryUrl(GOOGLE_CALENDAR_API_URL),
		timeout: TIMEOUT_MS,
		fetchImplementation: globalThis.fetch,
	});

	async function pages<T>(
		load: (pageToken?: string) => Promise<{ data: { items?: T[]; nextPageToken?: string | null } }>,
		action: string,
	): Promise<T[]> {
		const items: T[] = [];
		let pageToken: string | undefined;
		for (let page = 0; page < MAX_PAGES; page++) {
			try {
				const { data } = await load(pageToken);
				items.push(...(data.items ?? []));
				pageToken = data.nextPageToken ?? undefined;
				if (!pageToken) return items;
			} catch (error) {
				throw apiError(error, action);
			}
		}
		throw new GoogleCalendarError("Google Calendar returnerte for mange sider.");
	}

	return {
		async listCalendars(): Promise<Calendar[]> {
			const calendars = await pages(
				(pageToken) => client.calendarList.list({ maxResults: 250, pageToken }),
				"kunne ikke lese kalenderlisten",
			);
			return calendars.filter((item): item is Calendar => Boolean(item.id));
		},

		async freeBusy(calendarIds: string[], timeMin: string, timeMax: string) {
			if (!calendarIds.length)
				throw new GoogleCalendarError("Velg minst én kalender per intervjuer.");
			let body: calendar_v3.Schema$FreeBusyResponse;
			try {
				const { data } = await client.freebusy.query({
					requestBody: {
						timeMin,
						timeMax,
						timeZone: "Europe/Oslo",
						items: calendarIds.map((id) => ({ id })),
					},
				});
				body = data;
			} catch (error) {
				throw apiError(error, "kunne ikke lese opptattstatus");
			}
			const readableCalendars: Record<string, { busy: Busy[] }> = {};
			for (const id of calendarIds) {
				const calendar = body.calendars?.[id];
				if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
					throw new GoogleCalendarError(
						"En valgt Google-kalender kan ikke leses. Kontroller kalenderens tilgang.",
					);
				}
				const busy = calendar.busy.flatMap((interval) =>
					typeof interval.start === "string" && typeof interval.end === "string"
						? [{ start: interval.start, end: interval.end }]
						: [],
				);
				if (busy.length !== calendar.busy.length)
					throw new GoogleCalendarError(
						"En valgt Google-kalender returnerte ugyldige opptattdata.",
					);
				readableCalendars[id] = { busy };
			}
			return readableCalendars;
		},

		async listEvents(
			calendarId: string,
			timeMin: string,
			timeMax: string,
		): Promise<CalendarEvent[]> {
			const events = await pages(
				(pageToken) =>
					client.events.list({
						calendarId,
						timeMin,
						timeMax,
						singleEvents: true,
						showDeleted: false,
						maxResults: 2500,
						pageToken,
						fields:
							"items(id,iCalUID,status,transparency,start,end,extendedProperties),nextPageToken",
					}),
				"kunne ikke lese kalenderhendelser",
			);
			return events as CalendarEvent[];
		},

		async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent | null> {
			try {
				const { data } = await client.events.get({ calendarId, eventId });
				return data as CalendarEvent;
			} catch (error) {
				if ([404, 410].includes(statusCode(error) ?? 0)) return null;
				throw apiError(error, "kunne ikke hente intervjuet");
			}
		},

		async upsertEvent(calendarId: string, eventId: string, event: Record<string, unknown>) {
			if (!/^[a-v0-9]{5,1024}$/.test(eventId))
				throw new GoogleCalendarError("Ugyldig stabil Google Calendar event-id.");
			try {
				await client.events.update({
					calendarId,
					eventId,
					sendUpdates: "all",
					requestBody: event,
				});
				return eventId;
			} catch (error) {
				if (statusCode(error) !== 404) throw apiError(error, "kunne ikke oppdatere intervjuet");
			}
			try {
				await client.events.insert({
					calendarId,
					sendUpdates: "all",
					requestBody: { ...event, id: eventId },
				});
				return eventId;
			} catch (error) {
				if (statusCode(error) === 409) return eventId;
				throw apiError(error, "kunne ikke opprette intervjuet");
			}
		},

		async cancelEvent(calendarId: string, eventId: string) {
			try {
				await client.events.delete({ calendarId, eventId, sendUpdates: "all" });
			} catch (error) {
				if (![404, 410].includes(statusCode(error) ?? 0))
					throw apiError(error, "kunne ikke avlyse intervjuet");
			}
		},
	};
}

export function calendarEventId(key: string) {
	return sha256(key);
}
