import { describe, expect, it } from "vitest";
import {
	eventHref,
	groupByMonth,
	matchesSearch,
	type OverviewEvent,
	registrations,
	splitIntoSections,
} from "./sections";

const NOW = Date.parse("2026-08-24T10:00:00Z");
const BEFORE_NOW = Date.parse("2026-08-11T15:30:00Z");
const AFTER_NOW = Date.parse("2026-09-08T14:15:00Z");

function overviewEvent(overrides: Partial<OverviewEvent> = {}): OverviewEvent {
	return {
		_id: "event1" as OverviewEvent["_id"],
		slug: "workshop-med-jetbrains",
		title: "Workshop med JetBrains",
		eventStart: AFTER_NOW,
		registrationOpens: BEFORE_NOW,
		participationLimit: 50,
		externalEvent: false,
		published: true,
		companyName: "JetBrains",
		companyLogoUrl: null,
		leadName: "Victor Uhnger",
		myRole: null,
		registeredCount: 12,
		waitlistCount: 0,
		feedbackStatus: null,
		...overrides,
	};
}

describe("splitIntoSections", () => {
	it("shows my upcoming events and my past events with a report to review", () => {
		const upcomingMine = overviewEvent({ title: "Kommende", myRole: "medhjelper" });
		const pastWithDraft = overviewEvent({
			title: "Gjennomført med rapport",
			eventStart: BEFORE_NOW,
			myRole: "hovedansvarlig",
			feedbackStatus: "draft",
		});
		const pastDelivered = overviewEvent({
			title: "Gjennomført levert",
			eventStart: BEFORE_NOW,
			myRole: "hovedansvarlig",
			feedbackStatus: "delivered",
		});
		const notMine = overviewEvent({ title: "Andres" });
		const unpublishedMine = overviewEvent({ published: false, myRole: "hovedansvarlig" });

		const { mine } = splitIntoSections(
			[pastWithDraft, pastDelivered, upcomingMine, notMine, unpublishedMine],
			NOW,
		);

		expect(mine).toEqual([pastWithDraft, upcomingMine]);
	});

	it("splits published events into upcoming ascending and past newest first", () => {
		const first = overviewEvent({ title: "Først", eventStart: BEFORE_NOW - 1000 });
		const second = overviewEvent({ title: "Andre", eventStart: BEFORE_NOW });
		const third = overviewEvent({ title: "Tredje", eventStart: AFTER_NOW });
		const hidden = overviewEvent({ title: "Skjult", published: false });

		const { upcoming, past, unpublished } = splitIntoSections([first, second, third, hidden], NOW);

		expect(upcoming).toEqual([third]);
		expect(past).toEqual([second, first]);
		expect(unpublished).toEqual([hidden]);
	});

	it("keeps my events while the search filters the other sections", () => {
		const mineUpcoming = overviewEvent({ title: "Workshop med JetBrains", myRole: "medhjelper" });
		const other = overviewEvent({ title: "Kodekveld", companyName: "Kantega" });
		const hidden = overviewEvent({ title: "Skjult", companyName: "Bekk", published: false });

		const { mine, upcoming, unpublished } = splitIntoSections(
			[mineUpcoming, other, hidden],
			NOW,
			"kantega",
		);

		expect(mine).toEqual([mineUpcoming]);
		expect(upcoming).toEqual([other]);
		expect(unpublished).toEqual([]);
	});
});

describe("matchesSearch", () => {
	it("matches title, company or lead regardless of case, and everything when empty", () => {
		const event = overviewEvent({
			title: "Kodekveld",
			companyName: "Kantega",
			leadName: "Victor Uhnger",
		});

		expect(matchesSearch(event, "KODE")).toBe(true);
		expect(matchesSearch(event, " kantega ")).toBe(true);
		expect(matchesSearch(event, "uhnger")).toBe(true);
		expect(matchesSearch(event, "")).toBe(true);
		expect(matchesSearch(event, "bekk")).toBe(false);
	});

	it("ignores a missing lead", () => {
		const event = overviewEvent({ leadName: null });

		expect(matchesSearch(event, "uhnger")).toBe(false);
	});
});

describe("groupByMonth", () => {
	it("groups consecutive events by their month in Oslo", () => {
		const lateAugustInOslo = overviewEvent({ eventStart: Date.parse("2026-08-31T22:30:00Z") });
		const september = overviewEvent({ eventStart: AFTER_NOW });
		const august = overviewEvent({ eventStart: BEFORE_NOW });

		const groups = groupByMonth([august, lateAugustInOslo, september]);

		expect(groups.map((group) => [group.label, group.events.length])).toEqual([
			["august", 1],
			["september", 2],
		]);
	});
});

describe("registrations", () => {
	it("describes why an event has no count", () => {
		expect(registrations(overviewEvent({ published: false }), NOW)).toEqual({
			kind: "note",
			text: "Upublisert",
		});
		expect(registrations(overviewEvent({ externalEvent: true }), NOW)).toEqual({
			kind: "note",
			text: "Ekstern påmelding",
		});
		expect(
			registrations(overviewEvent({ registrationOpens: Date.parse("2026-08-27T10:00:00Z") }), NOW),
		).toEqual({ kind: "note", text: "Åpner 27. aug." });
	});

	it("counts registrations once registration has opened", () => {
		const event = overviewEvent({ registeredCount: 60, participationLimit: 60, waitlistCount: 8 });

		expect(registrations(event, NOW)).toEqual({
			kind: "count",
			registered: 60,
			limit: 60,
			waitlist: 8,
		});
	});
});

describe("eventHref", () => {
	it("prefers the slug and falls back to the id", () => {
		expect(eventHref(overviewEvent())).toBe("/events/workshop-med-jetbrains");
		expect(eventHref(overviewEvent({ slug: undefined }))).toBe("/events/event1");
	});
});
