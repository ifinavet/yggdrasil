import { humanReadableDateTime } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import { countdownLabel, registrationStatus, spotsLabel } from "./event-availability";

describe("spotsLabel", () => {
	it("shows the remaining spots", () => {
		expect(spotsLabel(28)).toBe("28 plasser igjen");
		expect(spotsLabel(0)).toBe("0 plasser igjen");
	});

	it("uses singular for one spot", () => {
		expect(spotsLabel(1)).toBe("1 plass igjen");
	});
});

describe("countdownLabel", () => {
	const now = Date.UTC(2026, 9, 4, 12, 0);
	const hour = 60 * 60 * 1000;

	it("counts days ahead", () => {
		expect(countdownLabel(now + 3 * 24 * hour, now)).toBe("om 3 dager");
	});

	it("counts hours on the day", () => {
		expect(countdownLabel(now + 5 * hour, now)).toBe("om 5 timer");
	});

	it("is empty once the event has started", () => {
		expect(countdownLabel(now, now)).toBeNull();
		expect(countdownLabel(now - hour, now)).toBeNull();
	});
});

describe("registrationStatus", () => {
	const hour = 60 * 60 * 1000;
	const day = 24 * hour;
	// Tuesday 13 October 2026, 12:00 UTC.
	const now = new Date(Date.UTC(2026, 9, 13, 12));
	const GREEN = "border-emerald-700 bg-emerald-700";
	const GREY = "border-zinc-400 bg-zinc-400";

	function event(overrides: Partial<Parameters<typeof registrationStatus>[0]> = {}) {
		return {
			registrationOpens: now.getTime() - 3 * day,
			eventStart: now.getTime() + 3 * day,
			registrationPhase: "open" as const,
			participationCount: 10,
			participationLimit: 50,
			...overrides,
		};
	}

	it("shows when registration opens while it is upcoming", () => {
		const registrationOpens = now.getTime() + day;
		expect(
			registrationStatus(event({ registrationOpens, registrationPhase: "upcoming" }), now),
		).toEqual({
			showBanner: true,
			statusMessage: `Påmeldingen åpner ${humanReadableDateTime(new Date(registrationOpens))}`,
			cardColor: GREY,
		});
	});

	it("says there are spots left once registration has been open a while", () => {
		expect(registrationStatus(event(), now)).toEqual({
			showBanner: true,
			statusMessage: "Det er fortsatt ledige plasser",
			cardColor: GREEN,
		});
	});

	it("says registration is open on the day it opened", () => {
		const status = registrationStatus(event({ registrationOpens: now.getTime() - hour }), now);
		expect(status.statusMessage).toBe("Påmeldingen er åpen");
	});

	it("points to the waitlist when the event is full", () => {
		const status = registrationStatus(event({ participationCount: 50 }), now);
		expect(status.statusMessage).toBe("Påmeldingen er full, sett deg på venteliste!");
	});

	it("hides the banner once registration has closed, and greys the card the day after", () => {
		const startedToday = registrationStatus(
			event({ eventStart: now.getTime() - hour, registrationPhase: "closed" }),
			now,
		);
		expect([startedToday.showBanner, startedToday.cardColor]).toEqual([false, GREEN]);

		const startedYesterday = registrationStatus(
			event({ eventStart: now.getTime() - 2 * day, registrationPhase: "closed" }),
			now,
		);
		expect([startedYesterday.showBanner, startedYesterday.cardColor]).toEqual([false, GREY]);
	});

	it("treats an event without a phase as closed", () => {
		const status = registrationStatus(
			event({ eventStart: now.getTime() - 2 * day, registrationPhase: undefined }),
			now,
		);
		expect([status.showBanner, status.cardColor]).toEqual([false, GREY]);
	});
});
