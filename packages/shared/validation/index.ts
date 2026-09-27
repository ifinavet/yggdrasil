import { z } from "zod";

const ORG_NUMBER_PATTERN = /^\d{9}$/;

export const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function text(max: number, message: string) {
	return z.string({ error: message }).trim().min(1, message).max(max, message);
}

export function optionalText(max: number, message: string) {
	return z.string({ error: message }).trim().max(max, message).optional();
}

export function email(message: string) {
	return z.email({ error: message }).max(254, message);
}

export function orgNumber(message: string) {
	return z.string({ error: message }).regex(ORG_NUMBER_PATTERN, message);
}
