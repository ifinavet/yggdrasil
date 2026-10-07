import {
	DATE_PATTERNS,
	EVENT_SEMESTER_LABELS,
	eventSemesterOf,
	eventSemesterRange,
	formatOsloDate,
	formatOsloToday,
	isEventSemester,
	MONTH_NAMES,
	osloMonthName,
} from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("eventSemesterOf", () => {
	it("places July in spring and August in autumn", () => {
		expect(eventSemesterOf(Date.parse("2026-07-15T12:00:00Z"))).toEqual({
			semester: "vår",
			year: 2026,
		});
		expect(eventSemesterOf(Date.parse("2026-08-15T12:00:00Z"))).toEqual({
			semester: "høst",
			year: 2026,
		});
	});

	it("reads the Oslo calendar, not UTC, at the semester and year boundaries", () => {
		expect(eventSemesterOf(Date.parse("2026-07-31T22:30:00Z")).semester).toBe("høst");
		expect(eventSemesterOf(Date.parse("2026-12-31T23:30:00Z"))).toEqual({
			semester: "vår",
			year: 2027,
		});
	});
});

describe("eventSemesterRange", () => {
	it("covers spring from Oslo midnight on January 1 until August 1", () => {
		expect(eventSemesterRange("vår", 2026)).toEqual({
			start: Date.parse("2025-12-31T23:00:00Z"),
			end: Date.parse("2026-07-31T22:00:00Z"),
		});
	});

	it("covers autumn from August 1 until the next year starts in Oslo", () => {
		expect(eventSemesterRange("høst", 2026)).toEqual({
			start: Date.parse("2026-07-31T22:00:00Z"),
			end: Date.parse("2026-12-31T23:00:00Z"),
		});
	});
});

describe("month names", () => {
	it("lists the Norwegian months in calendar order", () => {
		expect(MONTH_NAMES).toHaveLength(12);
		expect(MONTH_NAMES[0]).toBe("januar");
		expect(MONTH_NAMES[11]).toBe("desember");
	});

	it("names the Oslo month of a moment", () => {
		expect(osloMonthName(Date.parse("2026-08-31T22:30:00Z"))).toBe("september");
	});
});

describe("isEventSemester", () => {
	it("accepts only vår and høst", () => {
		expect(isEventSemester("vår")).toBe(true);
		expect(isEventSemester("høst")).toBe(true);
		expect(isEventSemester("Vår")).toBe(false);
		expect(isEventSemester(null)).toBe(false);
		expect(isEventSemester(undefined)).toBe(false);
	});

	it("has a display label for every semester", () => {
		expect(EVENT_SEMESTER_LABELS).toEqual({ vår: "Vår", høst: "Høst" });
	});
});

describe("formatOsloToday", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("formats today's Oslo date as dd.MM.yyyy", () => {
		vi.useFakeTimers();
		vi.setSystemTime(Date.parse("2026-12-31T23:30:00Z"));

		expect(formatOsloToday()).toBe("01.01.2027");
	});
});

describe("formatOsloDate", () => {
	it("shows Oslo wall-clock time in summer", () => {
		expect(formatOsloDate(Date.parse("2026-07-01T10:15:00Z"), DATE_PATTERNS.time)).toBe("12:15");
	});

	it("shows Oslo wall-clock time in winter", () => {
		expect(formatOsloDate(Date.parse("2026-01-15T10:15:00Z"), DATE_PATTERNS.time)).toBe("11:15");
	});

	it("rolls over to the Oslo date before UTC midnight", () => {
		expect(formatOsloDate(Date.parse("2026-12-31T23:30:00.250Z"), "yyyy-MM-dd HH:mm:ss.SSS")).toBe(
			"2027-01-01 00:30:00.250",
		);
	});

	it("follows the spring daylight saving switch", () => {
		expect(formatOsloDate(Date.parse("2026-03-29T00:59:00Z"), DATE_PATTERNS.time)).toBe("01:59");
		expect(formatOsloDate(Date.parse("2026-03-29T01:00:00Z"), DATE_PATTERNS.time)).toBe("03:00");
	});
});
