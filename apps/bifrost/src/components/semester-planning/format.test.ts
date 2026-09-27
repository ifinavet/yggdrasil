import { describe, expect, it } from "vitest";
import {
	daysList,
	formatMoment,
	formatOrgNumber,
	initials,
	longDay,
	monthLabel,
	shortDay,
	shortDayTitle,
	studentRange,
} from "./format";

describe("semester days", () => {
	it("writes a day short in a sentence, on its own, and in full without the year", () => {
		expect(shortDay("2027-02-09")).toBe("tir 9. feb");
		expect(shortDayTitle("2027-02-09")).toBe("Tir 9. feb");
		expect(longDay("2027-02-09")).toBe("tirsdag 9. februar");
		expect(monthLabel("2027-02-09")).toBe("Februar");
		expect(daysList(["2027-03-02", "2027-03-04"])).toBe("tir 2. mars eller tor 4. mars");
	});
});

describe("formatMoment", () => {
	it("shows a moment in Oslo time, without the full stop after a short month", () => {
		// 23:30 UTC on 2 December is 00:30 on 3 December in Oslo.
		const moment = Date.UTC(2026, 11, 2, 23, 30);
		expect(formatMoment(moment, "day")).toBe("3. des");
		expect(formatMoment(moment, "dayTime")).toBe("3. des, 00:30");
		expect(formatMoment(moment, "longDay")).toBe("3. desember");
		expect(formatMoment(moment, "time")).toBe("00:30");
	});
});

describe("numbers", () => {
	it("groups an organization number in threes, whatever spacing it came with", () => {
		expect(formatOrgNumber("924773189")).toBe("924 773 189");
		expect(formatOrgNumber("924 77 3189")).toBe("924 773 189");
	});

	it("gives one number when the company gave one", () => {
		expect(studentRange(40, 40)).toBe("40");
		expect(studentRange(30, 40)).toBe("30–40");
	});

	it("takes the initials of the first two names", () => {
		expect(initials("Sara Kristiansen")).toBe("SK");
		expect(initials("  Ola  Nordmann Hansen ")).toBe("ON");
	});
});
