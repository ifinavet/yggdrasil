import { describe, expect, it } from "vitest";
import { googleCalendarUrl, outlookCalendarUrl, toCompactUtc } from "./calendar-links";

const event = {
	title: "Bedpres med Acme & co",
	location: "Store auditorium, OJD",
	eventStart: Date.UTC(2026, 9, 7, 15, 15),
	url: "https://ifinavet.no/events/acme",
};

describe("toCompactUtc", () => {
	it("formats as a basic UTC timestamp", () => {
		expect(toCompactUtc(event.eventStart)).toBe("20261007T151500Z");
	});
});

describe("googleCalendarUrl", () => {
	it("prefills title, four hour slot, location and event link", () => {
		const url = new URL(googleCalendarUrl(event));
		expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
		expect(url.searchParams.get("action")).toBe("TEMPLATE");
		expect(url.searchParams.get("text")).toBe(event.title);
		expect(url.searchParams.get("dates")).toBe("20261007T151500Z/20261007T191500Z");
		expect(url.searchParams.get("location")).toBe(event.location);
		expect(url.searchParams.get("details")).toBe(event.url);
	});
});

describe("outlookCalendarUrl", () => {
	it("prefills subject, four hour slot, location and event link", () => {
		const url = new URL(outlookCalendarUrl(event));
		expect(url.origin).toBe("https://outlook.office.com");
		expect(url.searchParams.get("subject")).toBe(event.title);
		expect(url.searchParams.get("startdt")).toBe("2026-10-07T15:15:00.000Z");
		expect(url.searchParams.get("enddt")).toBe("2026-10-07T19:15:00.000Z");
		expect(url.searchParams.get("location")).toBe(event.location);
		expect(url.searchParams.get("body")).toBe(event.url);
	});
});
