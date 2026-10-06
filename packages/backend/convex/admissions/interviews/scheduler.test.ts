import {
	isValidAvailability,
	makeSchedulingDays,
	makeSchedulingSlots,
	matchInterviews,
	overlapsLunch,
} from "@workspace/shared/admissions";
import {
	calendarDaysBetween,
	coversWindow,
	isValidTimeWindows,
	localDateAndMinute,
	localWindow,
	MINUTES_PER_DAY,
	overlaps,
} from "@workspace/shared/time";
import { describe, expect, it } from "vitest";

const settings = {
	duration: 20,
	buffer: 5,
	breakEvery: 3,
	breakMinutes: 15,
	lunch: true,
	room: "Beta",
	dayStart: 540,
	dayEnd: 960,
	breaks: [],
};

describe("production admissions scheduling", () => {
	it("validates strict calendar dates and non-overlapping minute windows", () => {
		expect(isValidTimeWindows([{ day: "2028-02-29", start: 0, end: MINUTES_PER_DAY }])).toBe(true);
		expect(isValidTimeWindows([{ day: "2026-02-30", start: 0, end: 60 }])).toBe(false);
		expect(isValidTimeWindows([{ day: "2027-02-01", start: 0, end: 60.5 }])).toBe(false);
		expect(isValidTimeWindows([{ day: "2027-02-01", start: 0, end: MINUTES_PER_DAY + 1 }])).toBe(
			false,
		);
		expect(
			isValidTimeWindows([
				{ day: "2027-02-01", start: 540, end: 600 },
				{ day: "2027-02-01", start: 600, end: 660 },
			]),
		).toBe(true);
		expect(
			isValidTimeWindows([
				{ day: "2027-02-01", start: 540, end: 615 },
				{ day: "2027-02-01", start: 600, end: 660 },
			]),
		).toBe(false);
	});

	it("keeps the applicant availability count limit in the admissions domain", () => {
		const windows = Array.from({ length: 113 }, (_, index) => ({
			day: new Date(Date.UTC(2027, 0, index + 1)).toISOString().slice(0, 10),
			start: 540,
			end: 555,
		}));
		expect(isValidTimeWindows(windows)).toBe(true);
		expect(isValidAvailability(windows)).toBe(false);
	});

	it("shares timezone-aware availability windows with the rest of the app", () => {
		expect(calendarDaysBetween("2027-03-26", "2027-03-30", "Europe/Oslo")).toEqual([
			"2027-03-26",
			"2027-03-27",
			"2027-03-28",
			"2027-03-29",
			"2027-03-30",
		]);
		expect(localDateAndMinute(Date.parse("2027-03-28T01:30:00Z"), "Europe/Oslo")).toEqual({
			day: "2027-03-28",
			minute: 210,
		});
		expect(localDateAndMinute(Date.parse("2026-01-01T01:30:00Z"), "America/New_York")).toEqual({
			day: "2025-12-31",
			minute: 20 * 60 + 30,
		});
		const target = localWindow(Date.parse("2027-03-28T01:30:00Z"), 30, "Europe/Oslo");
		expect(overlaps(target, { day: target.day, start: 220, end: 240 })).toBe(true);
		expect(
			coversWindow(
				[
					{ day: target.day, start: 210, end: 225 },
					{ day: target.day, start: 225, end: 240 },
				],
				target,
			),
		).toBe(true);
	});

	it("derives weekdays from the real interview window, including Oslo local dates", () => {
		expect(
			makeSchedulingDays(
				Date.parse("2027-03-26T12:00:00Z"),
				Date.parse("2027-03-30T12:00:00Z"),
				"Europe/Oslo",
			),
		).toEqual(["2027-03-26", "2027-03-29", "2027-03-30"]);
	});

	it("honors work hours, lunch, configured breaks and period pauses", () => {
		const slots = makeSchedulingSlots(
			{ ...settings, breaks: [{ day: "2027-03-29", start: 600, end: 660 }] },
			["2027-03-29"],
		);
		expect(slots.every((slot) => slot.start >= 540 && slot.end <= 960)).toBe(true);
		expect(slots.some((slot) => slot.start < 660 && slot.end > 600)).toBe(false);
		expect(slots.every((slot) => !overlapsLunch(slot))).toBe(true);
	});

	it("balances interviewers, uses scarce applicant availability first and never invents availability", () => {
		const day = "2027-03-29";
		const slots = makeSchedulingSlots({ ...settings, breakEvery: 100 }, [day]);
		const candidates = [
			{ id: "flexible", availability: [{ day, start: 540, end: 960 }] },
			{ id: "scarce", availability: [{ day, start: 615, end: 645 }] },
		];
		const team = ["a", "b", "c"].map((id) => ({
			id,
			busy: [],
		}));
		const assignments = matchInterviews(candidates, slots, team);
		expect(assignments).toHaveLength(2);
		expect(assignments.map((assignment) => assignment.candidateId)).toContain("scarce");
		expect(new Set(assignments.map((assignment) => assignment.slotId)).size).toBe(2);
		expect(new Set(assignments.flatMap((assignment) => assignment.interviewers)).size).toBe(3);
		expect(matchInterviews(candidates, slots, team.slice(0, 1))).toEqual([]);
	});

	it("excludes unavailable interviewers and respects combined busy time through the buffer", () => {
		const day = "2027-03-29";
		const slots = makeSchedulingSlots({ ...settings, breakEvery: 100 }, [day]);
		const candidates = [{ id: "candidate", availability: [{ day, start: 540, end: 960 }] }];
		const team = ["a", "b"].map((id) => ({
			id,
			busy: null,
		}));
		expect(matchInterviews(candidates, slots, team)).toEqual([]);
		const readable = team.map((person) => ({
			...person,
			busy: [{ day, start: 0, end: 600 }],
		}));
		const assignments = matchInterviews(candidates, slots, readable);
		expect(assignments).toHaveLength(1);
		expect(assignments[0]?.slotId).toBe(`${day}/615`);
	});
});
