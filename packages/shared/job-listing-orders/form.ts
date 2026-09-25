import { z } from "zod";
import { isIsoDate } from "../time/semester";
import type { JobListingOrderSettings } from "./settings";

export const MAX_LISTINGS_PER_ORDER = 10;
export const LOGO_CONTENT_TYPES = ["image/png", "image/svg+xml"] as const;
export const LOGO_MAX_BYTES = 1_000_000;
export const ORDER_SUBMISSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const RICH_TEXT_MAX_LENGTH = 20_000;

function text(max: number, message: string) {
	return z.string({ error: message }).trim().min(1, message).max(max, message);
}

function optionalText(max: number, message: string) {
	return z.string({ error: message }).trim().max(max, message).optional();
}

const email = (message: string) => z.email({ error: message }).max(254, message);

export function richTextIsEmpty(html: string): boolean {
	return (
		html
			.replaceAll(/<[^>]*>/g, "")
			.replaceAll("&nbsp;", "")
			.trim().length === 0
	);
}

function richText(message: string) {
	return z
		.string({ error: message })
		.max(RICH_TEXT_MAX_LENGTH, "Teksten er for lang.")
		.refine((html) => !richTextIsEmpty(html), message);
}

export const orderContactSchema = z.object({
	name: text(100, "Skriv navnet til kontaktpersonen."),
	email: email("Skriv en gyldig e-postadresse."),
	phone: z
		.string()
		.trim()
		.regex(/^(\+?[\d ]{8,20})?$/, "Skriv et gyldig telefonnummer.")
		.optional(),
});

export const orderBillingSchema = z.object({
	address: text(300, "Skriv fakturaadressen."),
	email: email("Skriv en gyldig fakturaepost."),
	reference: text(100, "Skriv en referanseperson."),
});

export type OrderBilling = z.infer<typeof orderBillingSchema>;

export const companyChangesSchema = z
	.object({
		displayName: text(100, "Skriv bedriftens navn.").optional(),
		description: richText("Skriv en beskrivelse av bedriften.").optional(),
		logo: z.string().min(1).optional(),
	})
	.refine(
		(changes) => changes.displayName ?? changes.description ?? changes.logo,
		"Endre minst ett felt, eller svar ja.",
	);

export type CompanyChanges = z.infer<typeof companyChangesSchema>;

const orderCompanySchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("existing"), companyId: z.string().min(1, "Velg bedriften.") }),
	z.object({
		kind: z.literal("new"),
		orgNumber: z.string().regex(/^\d{9}$/, "Velg bedriften fra Enhetsregisteret."),
		displayName: text(100, "Skriv bedriftens navn."),
		description: richText("Skriv en beskrivelse av bedriften."),
		logo: z.string({ error: "Last opp en logo." }).min(1, "Last opp en logo."),
	}),
]);

export function orderListingSchema(settings: JobListingOrderSettings, today: string) {
	return z.object({
		title: text(settings.titleMaxLength, `Tittelen kan ha høyst ${settings.titleMaxLength} tegn.`),
		teaser: text(
			settings.teaserMaxLength,
			`Introen kan ha høyst ${settings.teaserMaxLength} tegn.`,
		),
		description: richText("Beskriv stillingen."),
		applicationUrl: z.url({
			protocol: /^https?$/,
			error: "Skriv en gyldig lenke som starter med https://.",
		}),
		deadline: z
			.string({ error: "Velg en søknadsfrist." })
			.refine(isIsoDate, "Velg en søknadsfrist.")
			.refine((date) => date >= today, "Søknadsfristen har passert."),
		type: z.string().refine((type) => settings.jobTypes.includes(type), "Velg ansettelsesform."),
	});
}

export type OrderListing = z.infer<ReturnType<typeof orderListingSchema>>;

export function jobListingOrderSchema(settings: JobListingOrderSettings, today: string) {
	return z.object({
		company: orderCompanySchema,
		companyChanges: companyChangesSchema.optional(),
		productId: z.string().min(1, "Velg en pakke."),
		startup: z.boolean(),
		listings: z
			.array(orderListingSchema(settings, today))
			.min(1, "Legg til minst én annonse.")
			.max(MAX_LISTINGS_PER_ORDER, `Bestill høyst ${MAX_LISTINGS_PER_ORDER} annonser om gangen.`),
		contact: orderContactSchema,
		billing: orderBillingSchema.optional(),
		note: optionalText(1000, "Tilleggsinformasjonen kan ha høyst 1000 tegn."),
		confirmAmount: z.literal(true, { error: "Bekreft bestillingen og beløpet." }),
	});
}

export type JobListingOrderForm = z.infer<ReturnType<typeof jobListingOrderSchema>>;
