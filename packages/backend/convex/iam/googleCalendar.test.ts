import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	calendarEventId,
	externalBusyIntervals,
	googleCalendarClient,
	overlapsBusy,
	readExternalBusy,
} from "./googleCalendar";

const config = {
	serviceAccountEmail: "service@example.test",
	adminEmail: "admin@example.test",
	domain: "example.test",
	privateKey: "",
};
const scopes = [
	"https://www.googleapis.com/auth/calendar.events",
	"https://www.googleapis.com/auth/calendar.calendarlist.readonly",
	"https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

beforeAll(async () => {
	config.privateKey = await exportPKCS8(
		(await generateKeyPair("RS256", { extractable: true })).privateKey,
	);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("delegated Google Calendar client", () => {
	it("uses the requested interviewer subject and Calendar scope", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		vi.stubEnv("CONVEX_CLOUD_URL", "http://localhost:3212");
		vi.stubEnv("APP_ENV", "local");
		vi.stubEnv("IAM_FAKE_DIRECTORY_URL", "https://calendar.test");
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string, init: RequestInit) => {
				const requestUrl = String(url);
				calls.push({ url: requestUrl, init });
				if (requestUrl.endsWith("/token")) {
					const assertion = new URLSearchParams(String(init.body)).get("assertion");
					if (!assertion) throw new Error("Missing service-account assertion");
					const [, payload] = assertion.split(".");
					const jwt = JSON.parse(Buffer.from(payload, "base64url").toString());
					expect(jwt.sub).toBe("interviewer@example.test");
					expect(jwt.scope).toBe(scopes);
					return Response.json({ access_token: "calendar-token", expires_in: 3600 });
				}
				return Response.json({ items: [{ id: "primary", summary: "Primary" }] });
			}),
		);

		await expect(
			googleCalendarClient(config, "interviewer@example.test").listCalendars(),
		).resolves.toEqual([{ id: "primary", summary: "Primary" }]);
		expect(calls.at(-1)?.url).toContain("calendar/v3/users/me/calendarList");
		expect(calls.every(({ url }) => url.startsWith("https://calendar.test/"))).toBe(true);
	});

	it("reads free busy for the selected calendars and fails closed on inaccessible calendars", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ access_token: "calendar-token", expires_in: 3600 }))
			.mockResolvedValueOnce(
				Response.json({
					calendars: { private: { busy: [] }, timetable: { errors: [{ reason: "notFound" }] } },
				}),
			);
		vi.stubGlobal("fetch", fetch);
		const client = googleCalendarClient(config, "interviewer@example.test");

		await expect(
			client.freeBusy(["private", "timetable"], "2026-10-12T08:00:00Z", "2026-10-12T16:00:00Z"),
		).rejects.toThrow("En valgt Google-kalender kan ikke leses. Kontroller kalenderens tilgang.");
		const body = JSON.parse(String(fetch.mock.calls[1][1]?.body));
		expect(body.items.map((item: { id: string }) => item.id)).toEqual(["private", "timetable"]);
	});

	it("upserts by stable event id and deletes the same id on cancellation", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ access_token: "calendar-token", expires_in: 3600 }))
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(Response.json({ id: "0123456789abcdef0123456789abcdef" }))
			.mockResolvedValueOnce(Response.json({ id: "0123456789abcdef0123456789abcdef" }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetch);
		const client = googleCalendarClient(config, "interviewer@example.test");
		const event = {
			summary: "Opptaksintervju",
			start: { dateTime: "2026-10-12T08:00:00Z", timeZone: "Europe/Oslo" },
			end: { dateTime: "2026-10-12T08:15:00Z", timeZone: "Europe/Oslo" },
		};

		await client.upsertEvent("primary", "0123456789abcdef0123456789abcdef", event);
		await client.upsertEvent("primary", "0123456789abcdef0123456789abcdef", event);
		await client.cancelEvent("primary", "0123456789abcdef0123456789abcdef");
		expect(fetch.mock.calls.slice(1).map(([, init]) => init?.method)).toEqual([
			"PUT",
			"POST",
			"PUT",
			"DELETE",
		]);
		expect(String(fetch.mock.calls[1][0])).toContain("events/0123456789abcdef0123456789abcdef");
		expect(String(fetch.mock.calls[3][0])).toContain("events/0123456789abcdef0123456789abcdef");
	});

	it("treats an insert conflict as success for the stable event id", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ access_token: "calendar-token", expires_in: 3600 }))
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(new Response(null, { status: 409 }));
		vi.stubGlobal("fetch", fetch);
		const eventId = "0123456789abcdef0123456789abcdef";

		await expect(
			googleCalendarClient(config, "interviewer@example.test").upsertEvent("primary", eventId, {}),
		).resolves.toBe(eventId);
		expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "PUT", "POST"]);
	});

	it("includes Google’s HTTP status without echoing provider messages or tokens", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ access_token: "secret-token", expires_in: 3600 }))
				.mockResolvedValueOnce(
					Response.json({ error: { message: "Calendar access denied" } }, { status: 403 }),
				),
		);
		await expect(
			googleCalendarClient(config, "interviewer@example.test").listCalendars(),
		).rejects.toThrow("Google Calendar svarte 403 kunne ikke lese kalenderlisten.");
	});
});

describe("admissions event conflict filtering", () => {
	it("ignores only the matching owned event id and preserves metadata spoofing as busy", () => {
		const own = {
			id: "own-copy",
			start: { dateTime: "2026-10-12T08:00:00Z" },
			end: { dateTime: "2026-10-12T08:15:00Z" },
			extendedProperties: {
				shared: {
					navetAdmissionsInterviewId: "interview-server-id",
					navetAdmissionsPeriodId: "period-server-id",
				},
			},
		};
		const external = {
			id: "external",
			start: { dateTime: "2026-10-12T08:10:00Z" },
			end: { dateTime: "2026-10-12T08:30:00Z" },
			extendedProperties: {
				shared: {
					navetAdmissionsInterviewId: "another-interview",
					navetAdmissionsPeriodId: "period-server-id",
				},
			},
		};
		const wrongPeriod = {
			...own,
			id: "wrong-period",
			extendedProperties: {
				shared: {
					navetAdmissionsInterviewId: "interview-server-id",
					navetAdmissionsPeriodId: "other-period",
				},
			},
		};
		const spoofedId = { ...own, id: "candidate-controlled-event" };
		const ownedEvents = new Map([
			[
				"interview-server-id",
				{
					interviewId: "interview-server-id",
					periodId: "period-server-id",
					eventId: "own-copy",
				},
			],
		]);
		const busy = externalBusyIntervals([own, external, wrongPeriod, spoofedId], ownedEvents);
		expect(busy).toHaveLength(3);
		expect(externalBusyIntervals([own, external, wrongPeriod, spoofedId])).toHaveLength(4);
		const overlap = busy[0];
		if (!overlap) throw new Error("Expected an external busy interval");
		expect(
			overlapsBusy(overlap, Date.parse("2026-10-12T08:00:00Z"), Date.parse("2026-10-12T08:15:00Z")),
		).toBe(true);
	});

	it("ignores cancelled and transparent events while failing closed on malformed busy data", () => {
		expect(
			externalBusyIntervals([
				{ id: "cancelled", status: "cancelled" },
				{ id: "free", transparency: "transparent" },
			]),
		).toEqual([]);
		expect(() => externalBusyIntervals([{ id: "unreadable" }])).toThrow("ugyldig hendelsestid");
	});
});

it("preserves stable calendar identities across retries", async () => {
	expect(await calendarEventId("navet-admissions:interview-id")).toBe(
		"42f3def0525c8dae93a2c9e26ccccd9675aeef59e2065c4febe2e87124c33692",
	);
});

it("reconciles owned and external busy intervals without treating adjacent owned time as free", async () => {
	const owned = new Map([
		["interview", { eventId: "owned", interviewId: "interview", periodId: "period" }],
	]);
	const at = (minutes: number) => new Date(Date.UTC(2026, 9, 12, 10, minutes)).toISOString();
	const provider = {
		freeBusy: vi.fn().mockResolvedValue({ primary: { busy: [{ start: at(0), end: at(30) }] } }),
		listEvents: vi.fn().mockResolvedValue([
			{
				id: "owned",
				start: { dateTime: at(0) },
				end: { dateTime: at(15) },
				extendedProperties: {
					shared: { navetAdmissionsInterviewId: "interview", navetAdmissionsPeriodId: "period" },
				},
			},
			{ id: "external", start: { dateTime: at(15) }, end: { dateTime: at(30) } },
		]),
	};
	await expect(readExternalBusy(provider, ["primary"], at(0), at(30), owned)).resolves.toEqual([
		[{ start: Date.parse(at(15)), end: Date.parse(at(30)) }],
	]);
	provider.listEvents.mockResolvedValue([
		{ id: "external", start: { dateTime: at(15) }, end: { dateTime: at(30) } },
	]);
	await expect(readExternalBusy(provider, ["primary"], at(0), at(30), owned)).rejects.toThrow(
		"opptattstatus som ikke kan kontrolleres",
	);
});
