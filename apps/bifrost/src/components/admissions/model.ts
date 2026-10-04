import { PREVIEW_INTERVIEW_DAYS as days } from "@workspace/shared/admissions/preview";

export { PREVIEW_INTERVIEW_DAYS as days } from "@workspace/shared/admissions/preview";

import {
	type AvailabilityWindow,
	interviewerAvailable as available,
	makeSchedulingSlots,
	matchInterviews,
} from "@workspace/shared/admissions";
import { STUDY_PROGRAMS, STUDY_YEARS } from "@workspace/shared/constants";
import { formatOsloDate } from "@workspace/shared/time";
export const decisions = ["pending", "shortlist", "accepted", "rejected"] as const;
export type Decision = "pending" | "shortlist" | "accepted" | "rejected";
export type Candidate = {
	id: string;
	name: string;
	program: string;
	year: number;
	group: string;
	about: string;
	motivation: string;
	availability: AvailabilityWindow[];
	notes: string;
	decision: Decision;
	sent: boolean;
};
export type CandidateEdit = Partial<Pick<Candidate, "notes" | "decision" | "availability">>;

export type CalendarSource = {
	id: string;
	name: string;
	selected: boolean;
	readable: boolean;
	busy: AvailabilityWindow[];
};
export type Interviewer = {
	calendarStatus: "connected" | "disconnected" | "error";
	calendars: CalendarSource[];
	id: string;
	name: string;
	image?: string;
};
export type Slot = { id: string; day: string; start: number; end: number; room: string };
export type Interview = { candidateId: string; slotId: string; interviewers: string[] };
export type Settings = {
	duration: number;
	buffer: number;
	breakEvery: number;
	breakMinutes: number;
	lunch: boolean;
	room: string;
};
export const defaults: Settings = {
	duration: 15,
	buffer: 5,
	breakEvery: 3,
	breakMinutes: 15,
	lunch: true,
	room: "Beta",
};
export const programs = STUDY_PROGRAMS;
export const groups = ["Bedrift", "Web", "Promo", "Intern", "Økonomi"];
export const decisionLabels: Record<Decision, string> = {
	pending: "Til vurdering",
	shortlist: "Videre",
	accepted: "Tatt opp",
	rejected: "Avslått",
};
export function clock(minutes: number) {
	return `${Math.floor(minutes / 60)
		.toString()
		.padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
export function roomUrl(room: string) {
	return `https://ifirom.no/${encodeURIComponent(room.trim().toLocaleLowerCase("nb"))}`;
}

export function dateLabel(day: string) {
	return formatOsloDate(new Date(`${day}T12:00:00Z`).getTime(), "EEE d. MMM");
}
export function makeSlots(settings: Settings): Slot[] {
	return makeSchedulingSlots({ ...settings, dayStart: 9 * 60, dayEnd: 16 * 60, breaks: [] }, days);
}
// Preview matching is a deterministic constrained heuristic, not an optimality guarantee.
// The production scheduler must recheck live calendar conflicts before publishing.
export function match(candidates: Candidate[], slots: Slot[], team: Interviewer[]): Interview[] {
	const availableTeam = team.map((person) =>
		person.calendarStatus === "connected"
			? person
			: {
					...person,
					calendars: person.calendars.map((calendar) => ({ ...calendar, readable: false })),
				},
	);
	return matchInterviews(candidates, slots, availableTeam).map((assignment) => ({
		...assignment,
		interviewers: [...assignment.interviewers],
	}));
}
export const team: Interviewer[] = [
	"Kristin Berg",
	"Daniel Holm",
	"Sara Lund",
	"Philip Vik",
	"Emilie Dahl",
	"Jonas Strand",
].map((name, i) => ({
	id: `person-${i}`,
	name,
	image: `https://randomuser.me/api/portraits/${i % 2 === 0 ? "women" : "men"}/${i + 41}.jpg`,
	calendarStatus: "connected",
	calendars: [
		{
			id: "navet",
			name: "Navet",
			selected: true,
			readable: true,
			busy: days
				.filter((_, day) => day >= 5 || (day + i) % 5 === 4)
				.map((day) => ({ day, start: 540, end: 960 })),
		},
		{
			id: "timetable",
			name: "Timeplan",
			selected: true,
			readable: true,
			busy: i < 2 ? [{ day: "2026-10-12", start: 540, end: 560 }] : [],
		},
		{
			id: "personal",
			name: "Privat",
			selected: false,
			readable: true,
			busy: [{ day: "2026-10-13", start: 540, end: 720 }],
		},
	],
}));
const names = [
	"Anna Berg",
	"Sander Nguyen",
	"Maja Johansen",
	"Omar Hassan",
	"Nora Solberg",
	"Emil Larsen",
	"Sara Ahmed",
	"Thea Nilsen",
	"Jonas Tran",
	"Ingrid Dahl",
	"Aksel Bakken",
	"Linnea Holm",
	"Amir Ali",
	"Julie Strand",
	"Oliver Vik",
	"Hanna Lund",
	"Elias Jensen",
	"Sofie Moen",
	"Noah Wang",
	"Ida Hansen",
	"Filip Aasen",
	"Leah Eriksen",
	"Isak Nguyen",
	"Emma Lie",
	"Adam Saleh",
	"Aurora Foss",
	"Henrik Moe",
	"Yasmin Said",
	"Mathias Vang",
	"Selma Haugen",
	"Lucas Strand",
	"Frida Lien",
	"William Berg",
	"Alma Nguyen",
	"Jakob Lund",
	"Mina Dahl",
];
export function seedCandidates(): Candidate[] {
	return names.map((name, i) => ({
		id: `candidate-${i}`,
		name,
		program: programs[i % programs.length] ?? STUDY_PROGRAMS[0],
		year: STUDY_YEARS[i % STUDY_YEARS.length] ?? 1,
		group: groups[i % groups.length] ?? "Web",
		about:
			[
				"Jeg liker å samle folk og finne på ting sammen. På fritiden går jeg på tur og spiller brettspill.",
				"Jeg har flyttet til Oslo for å studere og vil gjerne bli bedre kjent med miljøet på IFI. Jeg liker å lage ting sammen med andre.",
				"Jeg er glad i problemløsing, musikk og klatring. Har tidligere vært med på å organisere fadderuke.",
			][i % 3] ?? "",
		motivation:
			"Jeg vil bidra til at flere føler seg hjemme på IFI, og lære hvordan vi lager gode arrangementer sammen.",
		availability: candidateDays(i).map((day) => ({ day, start: 540, end: 960 })),
		notes:
			i % 6 === 0 ? "Har erfaring fra frivillig arbeid. Vil gjerne bidra med planlegging." : "",
		decision: initialDecision(i),
		sent: false,
	}));
}

export function advanceRound(candidates: Candidate[]): Candidate[] {
	return candidates.map((candidate) => {
		if (candidate.decision === "shortlist")
			return { ...candidate, decision: "pending", sent: false };
		if (candidate.decision === "pending")
			return { ...candidate, decision: "rejected", sent: false };
		return candidate;
	});
}

export function interviewerAvailable(person: Interviewer, slot: Slot) {
	return person.calendarStatus === "connected" && available(person, slot);
}
function candidateDays(index: number) {
	if (index === 33) return [];
	if (index === 34) return ["2026-10-22"];
	if (index === 35) return ["2026-10-21"];
	return days.filter((_, day) => day < 5 && (index + day) % 3 !== 0);
}
function initialDecision(index: number): Decision {
	if (index < 3) return "accepted";
	if (index < 8) return "shortlist";
	return "pending";
}
