import { type AvailabilityWindow, isAvailable } from "./availability";

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
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(at);
	const part = (kind: Intl.DateTimeFormatPartTypes) =>
		parts.find(({ type }) => type === kind)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
}

export function makeSchedulingDays(startAt: number, endAt: number, timeZone: string) {
	const first = localDay(startAt, timeZone).split("-").map(Number);
	const last = localDay(endAt, timeZone).split("-").map(Number);
	const [firstYear = 0, firstMonth = 1, firstDay = 1] = first;
	const [lastYear = 0, lastMonth = 1, lastDay = 1] = last;
	const date = new Date(Date.UTC(firstYear, firstMonth - 1, firstDay));
	const lastDate = Date.UTC(lastYear, lastMonth - 1, lastDay);
	const days: string[] = [];
	while (date.getTime() <= lastDate) {
		if (date.getUTCDay() >= 1 && date.getUTCDay() <= 5) days.push(date.toISOString().slice(0, 10));
		date.setUTCDate(date.getUTCDate() + 1);
	}
	return days;
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
			if (settings.lunch && start < 780 && end > 720) {
				start = 780;
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
		isAvailable(candidate.availability, slot) &&
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
