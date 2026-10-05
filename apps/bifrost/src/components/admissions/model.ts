import {
	ADMISSION_SCHEDULING_DEFAULTS,
	type AvailabilityWindow,
} from "@workspace/shared/admissions";
import { formatOsloDate } from "@workspace/shared/time";

export { roomUrl } from "@workspace/shared/admissions";
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
	decisionLocked?: boolean;
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
	...ADMISSION_SCHEDULING_DEFAULTS,
};
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
export function dateLabel(day: string) {
	return formatOsloDate(new Date(`${day}T12:00:00Z`).getTime(), "EEE d. MMM");
}
