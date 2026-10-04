import {
	makeSchedulingDays,
	makeSchedulingSlots,
	matchInterviews,
	overlapsLunch,
} from "@workspace/shared/admissions";
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
			calendars: [{ selected: true, readable: true, busy: [] }],
		}));
		const assignments = matchInterviews(candidates, slots, team);
		expect(assignments).toHaveLength(2);
		expect(assignments.map((assignment) => assignment.candidateId)).toContain("scarce");
		expect(new Set(assignments.map((assignment) => assignment.slotId)).size).toBe(2);
		expect(new Set(assignments.flatMap((assignment) => assignment.interviewers)).size).toBe(3);
		expect(matchInterviews(candidates, slots, team.slice(0, 1))).toEqual([]);
	});

	it("requires every selected calendar to be readable and free through the buffer", () => {
		const day = "2027-03-29";
		const slots = makeSchedulingSlots({ ...settings, breakEvery: 100 }, [day]);
		const candidates = [{ id: "candidate", availability: [{ day, start: 540, end: 960 }] }];
		const team = ["a", "b"].map((id) => ({
			id,
			calendars: [
				{ selected: true, readable: true, busy: [{ day, start: 0, end: 600 }] },
				{ selected: true, readable: false, busy: [] },
			],
		}));
		expect(matchInterviews(candidates, slots, team)).toEqual([]);
		const readable = team.map((person) => ({
			...person,
			calendars: person.calendars.slice(0, 1),
		}));
		const assignments = matchInterviews(candidates, slots, readable);
		expect(assignments).toHaveLength(1);
		expect(assignments[0]?.slotId).toBe(`${day}/615`);
	});
});
