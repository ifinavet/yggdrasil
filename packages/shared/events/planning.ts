import { z } from "zod";
import { STUDENT_CAP } from "../semester/application";
import { EVENT_TYPES, type EventType, FOOD_PURCHASERS } from "../semester/labels";

export const PLANNING_PATH = "/planlegg-arrangement";
export const PLANNING_CONFIRM_PATH = `${PLANNING_PATH}/bekreft`;
export const ANSWER_CHOICES = { yes: "Ja", no: "Nei", unsure: "Ikke avklart" } as const;
export const AGE_BY_ALCOHOL = { yes: "18", no: "none", unsure: "unsure" } as const;
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
export const PLANNING_QUESTIONS = {
	venue: {
		label: "Hvor skal bedriftspresentasjonen ta sted?",
		hint: "Det er mulig å ha den hos oss på IFI, eller et sted dere ønsker som f.eks. egne kontorer eller restaurant.\n\nVi kan booke vanlige forelesningsrom, men også studentpuben Escape. Studentpuben tar leiekostnader",
	},
	capacity: {
		label: "Hvor mange studenter ønsker dere å ha med på arrangementet?",
		hint: "Ordinært og faglig arrangement er til og med 40 studenter, mens stort arrangement er mer enn 40 (ofte 70-80).",
	},
	startTime: {
		label: "Når ønsker dere at arrangementet skal starte?",
		hint: "Dere står helt fritt til å velge klokkeslettet selv, men grunnen til at vi oftest begynner 16:15 er fordi studentene sin studiehverdag er fram til 16:00.\n\nDet er da for å slippe å kollidere med potensielle obligatoriske forelesninger eller lignende fra instituttet sin side.\n\nSamtidig så er det behagelig å kunne dra rett fra skolen til et eksternt arrangement. Anbefaler derfor at arrangementet ikke burde starte før 16:15, men man kan selvfølgelig ta det litt senere på dagen om det er ønskelig.",
	},
	foodAndDrinks: {
		label: "Servering av mat og drikke, hvordan ønsker dere å gjøre dette?",
		hint: "Det er vanlig prosedyre å inkludere servering ved et arrangement. Ofte er dette pizza, sushi eller burritos, men kun fantasien setter grenser!\n\nMange bedrifter tar også med studentene ut på restaurantbesøk etter at opplegget er ferdig. Vi fikser selvfølgelig mat og drikke om dette er noe dere ønsker.",
	},
	alcohol: {
		label: "Skal det serveres alkohol?",
		hint: "Med alkoholservering blir det 18-årsgrense.",
	},
	description: {
		label: "Beskrivelse av arrangementet.",
		hint: "Supert om dere kan skrive en liten promoteringstekst som vi bruker på arrangementet på ifinavet.no.\n\nArrangementet blir også delt i forskjellige grupper på sosiale medier 1 uke før arrangementet tar sted, det er også da påmeldingen åpnes så er viktig at denne er klar før det.",
	},
	stand: {
		label: "Ønsker dere å ha en stand på IFI i forkant?",
		hint: "Dette anbefales sterkt, da det tiltrekker seg mange studenter og gir dere en ekstra mulighet til å komme i kontakt med studentene og fylle opp plassene.\n\nVi oppfordrer til å ha med merch eller servering. Kaffe kan vi hjelpe med å kjøpe på skolen.",
	},
} as const;

export const PLANNING_FIELDS = {
	title: {
		label: "Tittel",
		hint: "",
		max: 200,
	},
	teaser: {
		label: "Kort introduksjon",
		hint: "Én eller to setninger til arrangementsoversikten.",
		max: 250,
	},
	description: {
		label: "Beskrivelse",
		hint: "",
		max: 15000,
	},
	location: {
		label: "Adresse eller lokale",
		hint: "",
		max: 500,
	},
	food: {
		label: "Ønsket mat og drikke",
		hint: "",
		max: 2000,
	},
	standDetails: {
		label: "Når ønsker dere stand, og hva trenger dere hjelp til?",
		hint: "",
		max: 1000,
	},
	notes: {
		label: "Andre ønsker",
		hint: "",
		max: 2000,
	},
} as const;
const answer = z.enum(["yes", "no", "unsure"]);
export const planningAnswersSchema = z.object({
	requestedEventType: z.enum(EVENT_TYPES).optional(),
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
