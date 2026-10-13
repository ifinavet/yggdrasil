import { describe, expect, it } from "vitest";
import { firstSelectableDays } from "./model";

const today = new Date(Date.UTC(2026, 9, 13, 22, 30));

describe("firstSelectableDays", () => {
	it("starts every date at today in Oslo when nothing is chosen", () => {
		const days = firstSelectableDays(
			{ applicationStart: "", applicationEnd: "", interviewStart: "" },
			today,
		);
		const midnight = new Date(2026, 9, 14);
		expect(days).toEqual({
			applicationStart: midnight,
			applicationEnd: midnight,
			interviewStart: midnight,
			interviewEnd: midnight,
		});
	});

	it("keeps each date on or after the one before and interviews after the deadline", () => {
		const days = firstSelectableDays(
			{
				applicationStart: "2026-10-20",
				applicationEnd: "2026-11-01",
				interviewStart: "2026-11-04",
			},
			today,
		);
		expect(days.applicationEnd).toEqual(new Date(2026, 9, 20));
		expect(days.interviewStart).toEqual(new Date(2026, 10, 2));
		expect(days.interviewEnd).toEqual(new Date(2026, 10, 4));
	});
});
