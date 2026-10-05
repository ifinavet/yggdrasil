import { coversWindow, localDateAndMinute, weekdaysBetween } from "../time";
import type { AvailabilityWindow } from "./availability";

export const LUNCH_START_MINUTE = 12 * 60;
export const LUNCH_END_MINUTE = 12 * 60 + 30;
export const MIN_INTERVIEW_NOTICE_MS = 48 * 60 * 60 * 1000;
export const ADMISSION_SCHEDULING_DEFAULTS = {
	duration: 15,
	buffer: 5,
	breakEvery: 3,
	breakMinutes: 15,
	lunch: true,
	room: "Beta",
	dayStart: 9 * 60,
	dayEnd: 16 * 60,
} as const;

export function overlapsLunch(window: AvailabilityWindow) {
	return window.start < LUNCH_END_MINUTE && window.end > LUNCH_START_MINUTE;
}

export type SchedulingSettings = Readonly<{
	duration: number;
	buffer: number;
	breakEvery: number;
	breakMinutes: number;
	lunch: boolean;
	room: string;
	dayStart: number;
	dayEnd: number;
	breaks: readonly AvailabilityWindow[];
}>;
export type SchedulingSlot = AvailabilityWindow & Readonly<{ id: string; room: string }>;
export type SchedulingCalendar = Readonly<{
	selected: boolean;
	readable: boolean;
	busy: readonly AvailabilityWindow[];
}>;
export type SchedulingInterviewer = Readonly<{
	id: string;
	calendars: readonly SchedulingCalendar[];
}>;
export type SchedulingCandidate = Readonly<{
	id: string;
	availability: readonly AvailabilityWindow[];
}>;
export type SchedulingAssignment = Readonly<{
	candidateId: string;
	slotId: string;
	interviewers: readonly string[];
}>;

function localDay(at: number, timeZone: string) {
	return localDateAndMinute(at, timeZone).day;
}

export function makeSchedulingDays(startAt: number, endAt: number, timeZone: string) {
	return weekdaysBetween(localDay(startAt, timeZone), localDay(endAt, timeZone), timeZone);
}

export function makeSchedulingSlots(settings: SchedulingSettings, days: readonly string[]) {
	const slots: SchedulingSlot[] = [];
	for (const day of days) {
		let start = settings.dayStart;
		let consecutive = 0;
		while (start + settings.duration + settings.buffer <= settings.dayEnd) {
			const end = start + settings.duration + settings.buffer;
			const pause = settings.breaks.find(
				(entry) => entry.day === day && entry.start < end && start < entry.end,
			);
			if (pause) {
				start = pause.end;
				consecutive = 0;
				continue;
			}
			if (settings.lunch && overlapsLunch({ day, start, end })) {
				start = LUNCH_END_MINUTE;
				consecutive = 0;
				continue;
			}
			slots.push({ id: `${day}/${start}`, day, start, end, room: settings.room });
			start = end;
			consecutive++;
			if (consecutive === settings.breakEvery) {
				start += settings.breakMinutes;
				consecutive = 0;
			}
		}
	}
	return slots;
}

export function interviewerAvailable(person: SchedulingInterviewer, slot: AvailabilityWindow) {
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

export function matchInterviews(
	candidates: readonly SchedulingCandidate[],
	slots: readonly SchedulingSlot[],
	team: readonly SchedulingInterviewer[],
): SchedulingAssignment[] {
	const assignments: SchedulingAssignment[] = [];
	const loads = new Map<string, number>();
	const occupied = new Set<string>();
	const eligible = (candidate: SchedulingCandidate, slot: SchedulingSlot) =>
		coversWindow(candidate.availability, slot) &&
		team.filter((person) => interviewerAvailable(person, slot)).length >= 2;
	const sorted = [...candidates].sort(
		(a, b) =>
			slots.filter((slot) => eligible(a, slot)).length -
				slots.filter((slot) => eligible(b, slot)).length || a.id.localeCompare(b.id),
	);
	for (const candidate of sorted) {
		const slot = slots
			.filter((item) => !occupied.has(item.id) && eligible(candidate, item))
			.sort(
				(a, b) =>
					assignments.filter((assignment) => assignment.slotId.startsWith(a.day)).length -
						assignments.filter((assignment) => assignment.slotId.startsWith(b.day)).length ||
					a.id.localeCompare(b.id),
			)[0];
		if (!slot) continue;
		const pair = team
			.filter((person) => interviewerAvailable(person, slot))
			.sort((a, b) => (loads.get(a.id) ?? 0) - (loads.get(b.id) ?? 0) || a.id.localeCompare(b.id))
			.slice(0, 2);
		occupied.add(slot.id);
		for (const person of pair) loads.set(person.id, (loads.get(person.id) ?? 0) + 1);
		assignments.push({
			candidateId: candidate.id,
			slotId: slot.id,
			interviewers: pair.map(({ id }) => id),
		});
	}
	return assignments;
}
