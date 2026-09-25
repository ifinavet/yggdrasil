import { z } from "zod";
import { DEGREE_TYPES } from "../constants/degrees";
import { STUDY_PROGRAMS } from "../constants/programs";
import { isIsoDate } from "../time";
import {
	ESCAPE_ANSWERS,
	EVENT_TYPE_LABELS,
	EVENT_TYPES,
	type EventType,
	FOOD_PURCHASERS,
	VENUES,
} from "./labels";

// The Hugin application form. The same rules run in the browser and again on the server.

/** The most students each event type allows; `null` means no upper limit. */
export const STUDENT_CAP: Record<EventType, number | null> = {
	standard_presentation: 40,
	large_presentation: null,
	workshop: 40,
	social: 40,
};

const MAX_STUDENTS = 1000;

/** The one-time id the Hugin form sends with a submission, so a retry saves one application. */
export const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function text(max: number, message: string) {
	return z.string({ error: message }).trim().min(1, message).max(max, message);
}

function optionalText(max: number, message: string) {
	return z.string({ error: message }).trim().max(max, message).optional();
}

const email = (message: string) => z.email({ error: message }).max(254, message);

const students = z
	.number({ error: "Oppgi antall studenter som et helt tall." })
	.int("Oppgi antall studenter som et helt tall.")
	.min(1, "Oppgi minst 1 student.")
	.max(MAX_STUDENTS, `Oppgi høyst ${MAX_STUDENTS} studenter.`);

/** The company's contact person, whom Navet emails the offer link to. */
export const applicationContactSchema = z.object({
	name: text(100, "Skriv navnet til kontaktpersonen."),
	email: email("Skriv en gyldig e-postadresse til kontaktpersonen."),
	phone: z
		.string({ error: "Skriv et gyldig telefonnummer." })
		.trim()
		.regex(/^\+?[\d ]{8,20}$/, "Skriv et gyldig telefonnummer."),
});

export const applicationFormSchema = z
	.object({
		orgNumber: z
			.string({ error: "Velg bedriften fra Enhetsregisteret." })
			.regex(/^\d{9}$/, "Velg bedriften fra Enhetsregisteret."),
		contact: applicationContactSchema,
		eventType: z.enum(EVENT_TYPES, { error: "Velg hva slags arrangement dere ønsker." }),
		minStudents: students,
		maxStudents: students,
		description: text(2000, "Beskriv arrangementet med høyst 2000 tegn."),
		availableDates: z
			.array(z.string().refine(isIsoDate, "Ugyldig dato."), { error: "Velg minst én dato." })
			.min(1, "Velg minst én dato.")
			.max(60, "Velg høyst 60 datoer.")
			.refine(
				(dates) => new Set(dates).size === dates.length,
				"Hver dato kan bare velges én gang.",
			),
		datePreferences: optionalText(500, "Datopreferanser kan ha høyst 500 tegn."),
		venue: z.enum(VENUES, { error: "Velg sted." }),
		wantsToUseEscape: z.enum(ESCAPE_ANSWERS, {
			error: "Svar på om dere vil bruke Escape.",
		}),
		foodAndDrinks: z.boolean({ error: "Svar på om studentene får mat og drikke." }),
		foodPurchasedBy: z.enum(FOOD_PURCHASERS, {
			error: "Velg hvem som kjøper inn mat og drikke.",
		}),
		// How Navet invoices the company: an email address, free text (a reference, an address or
		// an EHF address), or both. At least one is required, checked below.
		billing: z.object({
			email: email("Skriv en gyldig e-postadresse for faktura.").optional(),
			details: optionalText(500, "Fakturainformasjonen kan ha høyst 500 tegn."),
		}),
		targetDegrees: z
			.array(z.enum(DEGREE_TYPES, { error: "Ugyldig grad." }))
			.max(DEGREE_TYPES.length),
		targetStudyPrograms: z
			.array(z.enum(STUDY_PROGRAMS, { error: "Ugyldig studieprogram." }))
			.max(STUDY_PROGRAMS.length),
		additionalInfo: optionalText(2000, "«Noe dere vil legge til?» kan ha høyst 2000 tegn."),
		consent: z.literal(true, { error: "Du må godta lagring for å sende søknaden." }),
	})
	.superRefine((form, ctx) => {
		if (!form.billing.email && !form.billing.details) {
			ctx.addIssue({
				code: "custom",
				path: ["billing"],
				message: "Skriv en e-post for faktura, eller hvordan dere vil ha fakturaen.",
			});
		}

		if (form.minStudents > form.maxStudents) {
			ctx.addIssue({
				code: "custom",
				path: ["minStudents"],
				message: "Minste antall kan ikke være større enn høyeste antall.",
			});
		}

		const cap = STUDENT_CAP[form.eventType];
		if (cap !== null && form.maxStudents > cap) {
			ctx.addIssue({
				code: "custom",
				path: ["maxStudents"],
				message: `${EVENT_TYPE_LABELS[form.eventType]} har plass til ${cap}. Velg «Stor bedriftspresentasjon» for flere.`,
			});
		}
	});

export type ApplicationForm = z.infer<typeof applicationFormSchema>;
