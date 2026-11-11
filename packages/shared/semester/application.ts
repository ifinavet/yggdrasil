import { z } from "zod";
import { DEGREE_TYPES } from "../constants/degrees";
import { STUDY_PROGRAMS } from "../constants/programs";
import { isIsoDate } from "../time";
import { email, optionalText, orgNumber, text } from "../validation";
import { APPLICATION_VENUES, ESCAPE_ANSWERS, FOOD_PURCHASERS } from "./labels";

// The Hugin application form. The same rules run in the browser and again on the server.

export function studentCapIssue(
	product: { name: string; maxStudents?: number },
	maxStudents: number,
): string | undefined {
	if (product.maxStudents === undefined || maxStudents <= product.maxStudents) return undefined;
	return `${product.name} har plass til ${product.maxStudents}.`;
}

const MAX_STUDENTS = 1000;
export const MISSING_PRODUCT = "Velg hva slags arrangement dere ønsker.";

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
		orgNumber: orgNumber("Velg bedriften."),
		contact: applicationContactSchema,
		productId: z.string({ error: MISSING_PRODUCT }).min(1, MISSING_PRODUCT),
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
		venue: z.enum(APPLICATION_VENUES, { error: "Velg sted." }),
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
			ehfInvoice: z.boolean().default(false),
		}),
		targetDegrees: z
			.array(z.enum(DEGREE_TYPES, { error: "Ugyldig grad." }))
			.max(DEGREE_TYPES.length),
		targetStudyPrograms: z
			.array(z.enum(STUDY_PROGRAMS, { error: "Ugyldig studieprogram." }))
			.max(STUDY_PROGRAMS.length),
		additionalInfo: optionalText(2000, "«Noe dere vil legge til?» kan ha høyst 2000 tegn."),
		consent: z.literal(true, { error: "Kryss av her, så vi kan ta vare på søknaden deres." }),
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
	});

export type ApplicationForm = z.infer<typeof applicationFormSchema>;

/** Where the link in the confirmation email leads; the token is in the fragment. */
export const APPLICATION_CONFIRM_PATH = "/bestill-bedpres/bekreft";

export const OFFER_PATH = "/bestill-bedpres/tilbud";

export function offerPath(token: string): string {
	return `${OFFER_PATH}/${token}`;
}
