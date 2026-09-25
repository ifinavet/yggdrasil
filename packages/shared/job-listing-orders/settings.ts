import { z } from "zod";
import { JOB_TYPES } from "../constants/job_types";

export const JOB_LISTING_ORDER_EMAIL = "annonse@ifinavet.no";

export const JOB_LISTING_ORDER_DEFAULTS = {
	intro: `Annonsene publiseres manuelt etter at vi har gått gjennom bestillingen. Spørsmål kan sendes til ${JOB_LISTING_ORDER_EMAIL}.`,
	jobTypes: [...JOB_TYPES],
	titleMaxLength: 40,
	teaserMaxLength: 85,
	open: true,
};

export const jobListingOrderSettingsSchema = z.object({
	intro: z.string().trim().min(1, "Skriv en intro.").max(1000, "Introen kan ha høyst 1000 tegn."),
	jobTypes: z
		.array(z.string().trim().min(1, "En ansettelsesform kan ikke være tom.").max(40))
		.min(1, "Legg til minst én ansettelsesform.")
		.max(20, "Legg til høyst 20 ansettelsesformer.")
		.refine((types) => new Set(types).size === types.length, "Ansettelsesformene må være unike."),
	titleMaxLength: z.number().int().min(10, "Tittelen må tillate minst 10 tegn.").max(200),
	teaserMaxLength: z.number().int().min(20, "Introen må tillate minst 20 tegn.").max(500),
	open: z.boolean(),
});

export type JobListingOrderSettings = z.infer<typeof jobListingOrderSettingsSchema>;
