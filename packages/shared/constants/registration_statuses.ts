export const REGISTRATION_STATUS_LABELS = {
	registered: "Registrert",
	pending: "Venter",
	waitlist: "På venteliste",
} as const;

export type RegistrationStatus = keyof typeof REGISTRATION_STATUS_LABELS;

export const REGISTRATION_STATUSES = Object.keys(
	REGISTRATION_STATUS_LABELS,
) as RegistrationStatus[];
