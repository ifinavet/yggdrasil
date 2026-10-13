import { describe, expect, it } from "vitest";
import { nextEventMonth, splitUpcomingPast } from "./events-feed";

const now = Date.UTC(2026, 9, 15, 12);
const at = (day: number) => ({ eventStart: Date.UTC(2026, 9, day, 12) });

describe("splitUpcomingPast", () => {
	it("sorts upcoming soonest first and past newest first", () => {
		const events = [at(1), at(28), at(20), at(10)];
		expect(splitUpcomingPast(events, now)).toEqual({
			upcoming: [at(20), at(28)],
			past: [at(10), at(1)],
		});
	});

	it("treats an event starting right now as upcoming", () => {
		expect(splitUpcomingPast([at(14), at(15)], now)).toEqual({
			upcoming: [at(15)],
			past: [at(14)],
		});
	});

	it("keeps a month with only past events newest first", () => {
		expect(splitUpcomingPast([at(1), at(5), at(3)], now)).toEqual({
			upcoming: [],
			past: [at(5), at(3), at(1)],
		});
	});

	it("does not mutate the input", () => {
		const events = [at(28), at(20)];
		splitUpcomingPast(events, now);
		expect(events).toEqual([at(28), at(20)]);
	});

	it("returns empty lists for no events", () => {
		expect(splitUpcomingPast([], now)).toEqual({ upcoming: [], past: [] });
	});
});

describe("nextEventMonth", () => {
	const september = { eventStart: Date.UTC(2026, 8, 24, 12) };
	const november = { eventStart: Date.UTC(2026, 10, 5, 12) };

	it("skips a month whose events are all past", () => {
		expect(nextEventMonth({ september: [september], oktober: [at(20)] }, now)).toBe("oktober");
	});

	it("picks the month of the soonest upcoming event regardless of key order", () => {
		expect(nextEventMonth({ november: [november], oktober: [at(28)] }, now)).toBe("oktober");
	});

	it("returns undefined when nothing is upcoming", () => {
		expect(nextEventMonth({ september: [september], oktober: [at(1)] }, now)).toBeUndefined();
	});

	it("uses the Oslo month for events near midnight", () => {
		const osloNovemberFirst = { eventStart: Date.UTC(2026, 9, 31, 23, 30) };
		expect(nextEventMonth({ oktober: [osloNovemberFirst] }, now)).toBe("november");
	});
});
