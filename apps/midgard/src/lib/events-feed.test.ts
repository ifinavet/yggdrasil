import { describe, expect, it } from "vitest";
import { nextEventMonth, sortUpcomingFirst } from "./events-feed";

const now = Date.UTC(2026, 9, 15, 12);
const at = (day: number) => ({ eventStart: Date.UTC(2026, 9, day, 12) });

describe("sortUpcomingFirst", () => {
	it("puts upcoming events first, soonest at the top", () => {
		const events = [at(1), at(28), at(20), at(10)];
		expect(sortUpcomingFirst(events, now)).toEqual([at(20), at(28), at(10), at(1)]);
	});

	it("treats an event starting right now as upcoming", () => {
		expect(sortUpcomingFirst([at(14), at(15)], now)).toEqual([at(15), at(14)]);
	});

	it("keeps a month with only past events newest first", () => {
		expect(sortUpcomingFirst([at(1), at(5), at(3)], now)).toEqual([at(5), at(3), at(1)]);
	});

	it("does not mutate the input", () => {
		const events = [at(28), at(20)];
		sortUpcomingFirst(events, now);
		expect(events).toEqual([at(28), at(20)]);
	});

	it("returns an empty list for no events", () => {
		expect(sortUpcomingFirst([], now)).toEqual([]);
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
