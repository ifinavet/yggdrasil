import { isAvailable } from "@workspace/shared/admissions";
import { assert, describe, expect, it } from "vitest";
import { advanceRound, defaults, makeSlots, match, seedCandidates, team } from "./model";

describe("admissions preview scheduling", () => {
	it("never double-books rooms, calendars or people and requires two available interviewers", () => {
		const candidates = seedCandidates();
		const slots = makeSlots(defaults);
		const result = match(candidates, slots, team);
		expect(new Set(result.map((i) => i.slotId)).size).toBe(result.length);
		expect(new Set(result.map((i) => i.candidateId)).size).toBe(result.length);
		for (const interview of result) {
			const slot = slots.find((s) => s.id === interview.slotId);
			assert(slot);
			expect(
				candidates
					.find((c) => c.id === interview.candidateId)
					?.availability.map((window) => window.day),
			).toContain(slot.day);
			expect(new Set(interview.interviewers).size).toBe(2);
			for (const id of interview.interviewers) {
				const person = team.find((p) => p.id === id);
				assert(person);
				for (const calendar of person.calendars.filter((calendar) => calendar.selected)) {
					for (const busy of calendar.busy.filter((busy) => busy.day === slot.day))
						expect(slot.start >= busy.end || slot.end <= busy.start).toBe(true);
				}
			}
			expect(slot.start + defaults.duration <= 720 || slot.start >= 750).toBe(true);
		}
		expect(result).toHaveLength(33);
	});
	it("leaves candidates unmatched rather than inventing availability", () => {
		expect(match(seedCandidates(), makeSlots(defaults), team.slice(0, 1))).toEqual([]);
	});
	it("respects the interview duration and buffer", () => {
		const slots = makeSlots({ ...defaults, duration: 25, buffer: 10 });
		for (const [index, slot] of slots.entries()) {
			const previous = slots[index - 1];
			if (previous?.day === slot.day)
				expect(slot.start - previous.start).toBeGreaterThanOrEqual(35);
		}
	});
});

it("advances shortlisted candidates, rejects remaining candidates and preserves decisions", () => {
	const candidates = seedCandidates();
	const next = advanceRound(candidates);
	for (const [index, candidate] of candidates.entries()) {
		const expected =
			candidate.decision === "shortlist"
				? "pending"
				: candidate.decision === "pending"
					? "rejected"
					: candidate.decision;
		expect(next[index]?.decision).toBe(expected);
		expect(next[index]?.notes).toBe(candidate.notes);
	}
	expect(candidates.some((candidate) => candidate.decision === "shortlist")).toBe(true);
});

it("requires both interviewers to be available through the interview and buffer", () => {
	const day = "2026-10-12";
	const candidates = seedCandidates()
		.slice(0, 10)
		.map((candidate) => ({ ...candidate, availability: [{ day, start: 540, end: 960 }] }));
	const people = team.slice(0, 2).map((person) => ({
		...person,
		calendars: [
			{
				id: "work",
				name: "Navet",
				selected: true,
				readable: true,
				busy: [
					{ day, start: 0, end: 600 },
					{ day, start: 640, end: 1440 },
				],
			},
		],
	}));
	const slots = makeSlots({ ...defaults, breakEvery: 100 }).filter((slot) => slot.day === day);
	const assignments = match(candidates, slots, people);
	expect(assignments).toHaveLength(2);
	for (const assignment of assignments) {
		const slot = slots.find((slot) => slot.id === assignment.slotId);
		expect(slot?.start).toBeGreaterThanOrEqual(600);
		expect(slot?.end).toBeLessThanOrEqual(640);
	}
	expect(
		match(
			candidates,
			slots,
			people.map((person) => ({ ...person, calendars: [] })),
		),
	).toEqual([]);
});

it("does not treat failed or unreadable calendars as free", () => {
	const candidates = seedCandidates();
	const slots = makeSlots(defaults);
	expect(
		match(
			candidates,
			slots,
			team.map((person) => ({ ...person, calendarStatus: "error" })),
		),
	).toEqual([]);
	expect(
		match(
			candidates,
			slots,
			team.map((person) => ({
				...person,
				calendars: person.calendars.map((calendar) => ({ ...calendar, readable: false })),
			})),
		),
	).toEqual([]);
});

it("keeps an applicant interview inside their submitted time block", () => {
	const candidate = seedCandidates()[0];
	assert(candidate);
	const result = match(
		[{ ...candidate, availability: [{ day: "2026-10-12", start: 600, end: 620 }] }],
		makeSlots({ ...defaults, breakEvery: 100 }),
		team,
	);
	expect(result).toHaveLength(1);
	expect(result[0]?.slotId).toBe("2026-10-12/600");
});

it("joins adjacent applicant blocks without filling gaps", () => {
	const day = "2026-10-12";
	const blocks = [
		{ day, start: 540, end: 600 },
		{ day, start: 600, end: 660 },
	];
	expect(isAvailable(blocks, { day, start: 590, end: 610 })).toBe(true);
	expect(
		isAvailable(
			[
				{ day, start: 540, end: 590 },
				{ day, start: 600, end: 660 },
			],
			{ day, start: 580, end: 610 },
		),
	).toBe(false);
});
