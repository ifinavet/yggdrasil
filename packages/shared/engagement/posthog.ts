import { z } from "zod";
import { REGISTRATION_STATUSES } from "../constants/registration_statuses";

const TIMESTAMP_PRECISION_MS = 1000;

const posthogUnregistrationSchema = z
	.tuple([
		z.string().min(1),
		z.string().min(1),
		z.enum(REGISTRATION_STATUSES),
		z.number().positive(),
		z.number().positive(),
		z.uuid(),
	])
	.refine(([, , , registrationTime, at]) => registrationTime < at + TIMESTAMP_PRECISION_MS)
	.transform(([eventId, userId, status, registrationTime, at, uuid]) => ({
		position: { at, uuid },
		row: { eventId, userId, status, registrationTime, at: Math.max(at, registrationTime) },
	}))
	.nullable()
	.catch(null);

export const posthogUnregistrationsSchema = z.object({
	results: z.array(posthogUnregistrationSchema),
});
