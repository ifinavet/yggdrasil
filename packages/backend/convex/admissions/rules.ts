import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export const MAX_APPLICATIONS = 200;
export const MAX_INTERVIEWERS = 30;
export const MAX_ROUNDS = 20;
export const MAX_OUTBOX_ATTEMPTS = 8;
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
