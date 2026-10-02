import { z } from "zod";
import { STUDENT_CAP } from "../semester/application";
import { type EventType, FOOD_PURCHASERS } from "../semester/labels";

export const PLANNING_PATH = "/planlegg-arrangement";
export const PLANNING_CONFIRM_PATH = `${PLANNING_PATH}/bekreft`;
export const ANSWER_CHOICES = { yes: "Ja", no: "Nei", unsure: "Ikke avklart" } as const;
export const VENUE_CHOICES = {
	campus: "IFI",
	escape: "Escape",
	own: "Egne lokaler",
	other: "Restaurant eller annet sted",
	unsure: "Ikke avklart",
} as const;
export const AGE_CHOICES = {
	"18": "18-årsgrense",
	none: "Ingen aldersgrense",
	unsure: "Ikke avklart",
} as const;
export const PLANNING_FIELDS = {
	title: {
		label: "Hva skal arrangementet hete?",
		hint: "En kort tittel som gjør studentene nysgjerrige.",
		max: 200,
	},
	teaser: {
		label: "Hvordan vil dere kort presentere arrangementet?",
		hint: "Én eller to setninger til arrangementsoversikten.",
		max: 250,
	},
	description: {
		label: "Hva får studentene oppleve?",
		hint: "Fortell om programmet, hvem det passer for og eventuelle forberedelser.",
		max: 15000,
	},
	location: {
		label: "Hva er adressen eller ønsket lokale?",
		hint: "Navet kan hjelpe med å booke rom på IFI. Escape har leiekostnader.",
		max: 500,
	},
	food: {
		label: "Hva ønsker dere å servere?",
		hint: "Skriv gjerne forslag til mat og drikke, og hva dere trenger hjelp til.",
		max: 2000,
	},
	standDetails: {
		label: "Når ønsker dere stand, og trenger dere hjelp med noe?",
		hint: "Fortell gjerne om ønsket tidspunkt, merch eller servering.",
		max: 1000,
	},
	notes: {
		label: "Er det noe annet dere ønsker å avklare med oss?",
		hint: "For eksempel ønsker om en annen arrangementstype.",
		max: 2000,
	},
} as const;
const answer = z.enum(["yes", "no", "unsure"]);
export const planningAnswersSchema = z
	.object({
		title: z.string().trim().max(200),
		teaser: z.string().trim().max(250),
		description: z.string().trim().max(15000),
		location: z.string().trim().max(500),
		food: z.string().trim().max(2000),
		notes: z.string().trim().max(2000),
		standDetails: z.string().trim().max(1000),
		capacity: z.number().int().min(1).max(1000),
		startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Velg et gyldig klokkeslett."),
		venue: z.enum(["campus", "escape", "own", "other", "unsure"]),
		foodAndDrinks: answer,
		foodPurchasedBy: z.enum(FOOD_PURCHASERS),
		alcohol: answer,
		ageRestriction: z.enum(["18", "none", "unsure"]),
		stand: answer,
		language: z.string().trim().max(100),
	})
	.superRefine((value, ctx) => {
		if ((value.venue === "escape" || value.alcohol === "yes") && value.ageRestriction !== "18") {
			ctx.addIssue({
				code: "custom",
				path: ["ageRestriction"],
				message: "Escape og alkoholservering krever 18-årsgrense.",
			});
		}
	});
export type PlanningAnswers = z.infer<typeof planningAnswersSchema>;
export function planningCapacityLimit(eventType: EventType) {
	return STUDENT_CAP[eventType] ?? 1000;
}
export function planningFormSchema(capacityLimit: number) {
	return planningAnswersSchema.refine((v) => v.capacity <= capacityLimit, {
		path: ["capacity"],
		message: `Avtalt pakke har plass til høyst ${capacityLimit} studenter. Kontakt Navet hvis dere ønsker flere.`,
	});
}
export const DELIVERY_LABELS = {
	pending: "Klargjøres",
	queued: "I sendekø",
	sent: "Sendt",
	delivered: "Levert",
	delayed: "Forsinket",
	failed: "Sending feilet",
	bounced: "Avvist av mottaker",
	complained: "Markert som søppelpost",
	cancelled: "Avbrutt",
} as const;

export function validContactEmail(value: string) {
	return z.email().safeParse(value).success;
}
