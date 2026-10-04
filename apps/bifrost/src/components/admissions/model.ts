import { STUDY_PROGRAMS, STUDY_YEARS } from "@workspace/shared/constants";
import { OSLO_TIME_ZONE } from "@workspace/shared/time";
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
	availability: string[];
	notes: string;
	decision: Decision;
	sent: boolean;
};
export type AvailabilityWindow = { day: string; start: number; end: number };
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
export const days = [
	"2026-10-12",
	"2026-10-13",
	"2026-10-14",
	"2026-10-15",
	"2026-10-16",
	"2026-10-19",
	"2026-10-20",
	"2026-10-21",
	"2026-10-22",
	"2026-10-23",
];
export function dateLabel(day: string) {
	return new Intl.DateTimeFormat("nb-NO", {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: OSLO_TIME_ZONE,
	}).format(new Date(`${day}T12:00:00Z`));
}
export function makeSlots(settings: Settings): Slot[] {
	const slots: Slot[] = [];
	for (const day of days) {
		let start = 9 * 60;
		let consecutive = 0;
		while (start + settings.duration <= 16 * 60) {
			if (
				settings.lunch &&
				start < 12 * 60 + 30 &&
				start + settings.duration + settings.buffer > 12 * 60
			) {
				start = 12 * 60 + 30;
				consecutive = 0;
			}
			slots.push({
				id: `${day}/${start}`,
				day,
				start,
				end: start + settings.duration + settings.buffer,
				room: settings.room,
			});
			start += settings.duration + settings.buffer;
			consecutive++;
			if (consecutive === settings.breakEvery) {
				start += settings.breakMinutes;
				consecutive = 0;
			}
		}
	}
	return slots;
}
// Preview matching is a deterministic constrained heuristic, not an optimality guarantee.
// The production scheduler must recheck live calendar conflicts before publishing.
export function match(candidates: Candidate[], slots: Slot[], team: Interviewer[]): Interview[] {
	const assignments: Interview[] = [];
	const loads = new Map<string, number>();
	const occupied = new Set<string>();
	const eligible = (candidate: Candidate, slot: Slot) =>
		candidate.availability.includes(slot.day) &&
		team.filter((p) => interviewerAvailable(p, slot)).length >= 2;
	const sorted = [...candidates].sort(
		(a, b) =>
			slots.filter((s) => eligible(a, s)).length - slots.filter((s) => eligible(b, s)).length ||
			a.id.localeCompare(b.id),
	);
	for (const candidate of sorted) {
		const slot = slots
			.filter((s) => !occupied.has(s.id) && eligible(candidate, s))
			.sort(
				(a, b) =>
					assignments.filter((i) => i.slotId.startsWith(a.day)).length -
						assignments.filter((i) => i.slotId.startsWith(b.day)).length ||
					a.id.localeCompare(b.id),
			)[0];
		if (!slot) continue;
		const pair = team
			.filter((p) => interviewerAvailable(p, slot))
			.sort((a, b) => (loads.get(a.id) ?? 0) - (loads.get(b.id) ?? 0) || a.id.localeCompare(b.id))
			.slice(0, 2);
		occupied.add(slot.id);
		for (const person of pair) loads.set(person.id, (loads.get(person.id) ?? 0) + 1);
		assignments.push({
			candidateId: candidate.id,
			slotId: slot.id,
			interviewers: pair.map((p) => p.id),
		});
	}
	return assignments;
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
		availability: candidateDays(i),
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
	if (person.calendarStatus !== "connected") return false;
	const calendars = person.calendars.filter((calendar) => calendar.selected);
	return (
		calendars.length > 0 &&
		calendars.every(
			(calendar) =>
				calendar.readable &&
				!calendar.busy.some(
					(busy) => busy.day === slot.day && busy.start < slot.end && busy.end > slot.start,
				),
		)
	);
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
