import { MAX_OFFER_COMMENT_LENGTH, MAX_REQUESTED_DATES } from "@workspace/shared/semester/limits";
import { z } from "zod";

// Client-side rules for answering an offer. They mirror offers/mutations.ts, which has the last word.

export const acceptOfferSchema = z.object({
	acceptTerms: z
		.boolean()
		.refine((accepted) => accepted, "Dere må godta vilkårene for å godta datoen."),
});

const offerComment = z
	.string()
	.trim()
	.max(MAX_OFFER_COMMENT_LENGTH, `Kommentaren kan ha høyst ${MAX_OFFER_COMMENT_LENGTH} tegn.`);

export const requestNewDateSchema = z.object({
	dates: z
		.array(z.string())
		.min(1, "Velg minst én dato som passer bedre.")
		.max(MAX_REQUESTED_DATES, `Dere kan velge høyst ${MAX_REQUESTED_DATES} datoer.`),
	comment: offerComment,
});

export const declineOfferSchema = z.object({ comment: offerComment });
