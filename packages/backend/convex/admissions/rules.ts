import { overlapsLunch } from "@workspace/shared/admissions";
import { coversWindow, localWindow, overlaps } from "@workspace/shared/time";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

export const MAX_APPLICATIONS = 200;
export const MAX_INTERVIEWERS = 30;
export const MAX_ROUNDS = 20;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodWindowInput = Pick<
	Doc<"admissionPeriods">,
	"applicationStartAt" | "applicationEndAt" | "interviewStartAt" | "interviewEndAt" | "retentionAt"
>;

export function validatePeriodWindow(input: PeriodWindowInput, now = Date.now()) {
	if (
		![
			input.applicationStartAt,
			input.applicationEndAt,
			input.interviewStartAt,
			input.interviewEndAt,
			input.retentionAt,
		].every(Number.isFinite)
	)
		throw new ConvexError("Datoene må være gyldige tidspunkter.");
	if (
		input.applicationStartAt >= input.applicationEndAt ||
		input.interviewStartAt >= input.interviewEndAt
	) {
		throw new ConvexError("Datoene må stå i riktig rekkefølge.");
	}
	if (
		input.applicationEndAt - input.applicationStartAt > 14 * DAY_MS ||
		input.interviewEndAt - input.interviewStartAt > 14 * DAY_MS
	) {
		throw new ConvexError("Opptaksperioder kan ikke vare mer enn 14 dager.");
	}
	if (
		input.applicationEndAt > input.interviewStartAt ||
		input.interviewEndAt > input.retentionAt ||
		input.retentionAt <= now ||
		input.retentionAt > input.interviewEndAt + 60 * DAY_MS
	) {
		throw new ConvexError(
			"Søknadsfrist, intervjutid og slettefrist overlapper eller står i feil rekkefølge.",
		);
	}
}

export function validateSettings(settings: {
	duration: number;
	buffer: number;
	breakEvery: number;
	breakMinutes: number;
	room: string;
	dayStart: number;
	dayEnd: number;
}) {
	if (!Number.isInteger(settings.duration) || settings.duration < 5 || settings.duration > 120) {
		throw new ConvexError("Intervjuer må vare fra 5 til 120 minutter.");
	}
	if (!Number.isInteger(settings.buffer) || settings.buffer < 0 || settings.buffer > 60) {
		throw new ConvexError("Pausen mellom intervjuer må være fra 0 til 60 minutter.");
	}
	if (
		!Number.isInteger(settings.breakEvery) ||
		settings.breakEvery < 1 ||
		settings.breakEvery > 12
	) {
		throw new ConvexError("Antall intervjuer mellom pauser må være fra 1 til 12.");
	}
	if (
		!Number.isInteger(settings.breakMinutes) ||
		settings.breakMinutes < 0 ||
		settings.breakMinutes > 60
	) {
		throw new ConvexError("Pauselengden må være fra 0 til 60 minutter.");
	}
	if (
		!Number.isInteger(settings.dayStart) ||
		!Number.isInteger(settings.dayEnd) ||
		settings.dayStart < 0 ||
		settings.dayEnd > 1440 ||
		settings.dayStart >= settings.dayEnd
	) {
		throw new ConvexError("Arbeidsdagen må ha gyldig start- og sluttid.");
	}
	if (settings.dayStart + settings.duration + settings.buffer > settings.dayEnd) {
		throw new ConvexError("Arbeidsdagen må romme intervjuet og pausen mellom intervjuer.");
	}
	if (!settings.room.trim() || settings.room.length > 100)
		throw new ConvexError("Velg et gyldig intervjuerom.");
}

export function validateInterviewWindow(
	startAt: number,
	period: Doc<"admissionPeriods">,
	app: Doc<"admissionApplications">,
	confirmedOutsideForm = false,
) {
	if (
		startAt < period.interviewStartAt ||
		startAt + period.duration * 60000 > period.interviewEndAt
	)
		throw new ConvexError("Intervjutiden er utenfor perioden.");
	const window = localWindow(startAt, period.duration, period.timezone);
	const meeting = { ...window, end: window.start + period.duration + period.buffer };
	if (meeting.start < period.dayStart || meeting.end > period.dayEnd)
		throw new ConvexError("Intervjutiden er utenfor arbeidsdagen.");
	if (period.lunch && overlapsLunch(meeting))
		throw new ConvexError("Intervjutiden kolliderer med lunsjpausen.");
	if (period.breaks.some((pause) => overlaps(pause, meeting)))
		throw new ConvexError("Intervjutiden kolliderer med en pause.");
	if (
		app.status !== "submitted" ||
		(!coversWindow(app.availability, meeting) && !confirmedOutsideForm)
	)
		throw new ConvexError("Søkeren er ikke tilgjengelig på dette tidspunktet.");
}

export function interviewCalendarIds(
	period: Doc<"admissionPeriods">,
	interviewerIds: Id<"users">[],
) {
	return [
		...new Set(
			interviewerIds.flatMap(
				(userId) =>
					period.interviewers.find((selection) => selection.userId === userId)
						?.selectedCalendarIds ?? [],
			),
		),
	].sort((a, b) => a.localeCompare(b));
}

export function sameInterviewSchedule(
	previous: Pick<
		Doc<"admissionInterviews">,
		"startAt" | "endAt" | "room" | "interviewerIds" | "selectedCalendarIds"
	>,
	desired: typeof previous,
) {
	return (
		previous.startAt === desired.startAt &&
		previous.endAt === desired.endAt &&
		previous.room === desired.room &&
		previous.interviewerIds.length === desired.interviewerIds.length &&
		previous.interviewerIds.every((id) => desired.interviewerIds.includes(id)) &&
		previous.selectedCalendarIds.length === desired.selectedCalendarIds.length &&
		previous.selectedCalendarIds.every((id) => desired.selectedCalendarIds.includes(id))
	);
}
