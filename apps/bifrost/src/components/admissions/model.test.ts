import { describe, expect, it } from "vitest";
import { advanceRound, defaults, makeSlots, match, seedCandidates, team } from "./model";

describe("admissions preview scheduling", () => {
	it("never double-books rooms, calendars or people and requires two available interviewers", () => {
		const candidates = seedCandidates();
		const slots = makeSlots(defaults);
		const result = match(candidates, slots, team);
		expect(new Set(result.map((i) => i.slotId)).size).toBe(result.length);
		expect(new Set(result.map((i) => i.candidateId)).size).toBe(result.length);
		for (const interview of result) {
			const slot = slots.find((s) => s.id === interview.slotId)!;
			expect(candidates.find((c) => c.id === interview.candidateId)?.availability).toContain(
				slot.day,
			);
			expect(new Set(interview.interviewers).size).toBe(2);
			for (const id of interview.interviewers) {
				const p = team.find((p) => p.id === id)!;
				expect(p.available).toContain(slot.day);
				expect(p.busy).not.toContain(slot.id);
			}
			expect(slot.start + defaults.duration <= 720 || slot.start >= 750).toBe(true);
		}
		expect(result).toHaveLength(33);
	});
	it("leaves candidates unmatched rather than inventing availability", () => {
		expect(match(seedCandidates(), makeSlots(defaults), [team[0]!])).toEqual([]);
	});
	it("respects the interview duration and buffer", () => {
		const slots = makeSlots({ ...defaults, duration: 25, buffer: 10 });
		for (let i = 1; i < slots.length; i++) {
			if (slots[i]!.day === slots[i - 1]!.day)
				expect(slots[i]!.start - slots[i - 1]!.start).toBeGreaterThanOrEqual(35);
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
		.map((candidate) => ({ ...candidate, availability: [day] }));
	const people = team
		.slice(0, 2)
		.map((person) => ({ ...person, busy: [], windows: [{ day, start: 600, end: 640 }] }));
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
			people.map((person) => ({ ...person, windows: [] })),
		),
	).toEqual([]);
});
