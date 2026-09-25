import { z } from "zod";
import { PRODUCT_CATEGORIES } from "./categories";

export const MAX_PRODUCT_NAME_LENGTH = 100;
export const MAX_SHORT_DESCRIPTION_LENGTH = 300;
export const MAX_LONG_DESCRIPTION_LENGTH = 5000;
export const MAX_VOLUME_TIERS = 10;
const MAX_PRICE_ORE = 1_000_000_00;
const MAX_STUDENTS = 10_000;

const priceMessage = "Prisen må være et beløp mellom 0 og 1 000 000 kr.";
const priceOre = z
	.number({ error: priceMessage })
	.int(priceMessage)
	.min(0, priceMessage)
	.max(MAX_PRICE_ORE, priceMessage);

const tiersMessage = `Mengderabatter må ha 1 til ${MAX_VOLUME_TIERS} trinn med ulike antall.`;
const volumeTierSchema = z.object({
	quantity: z
		.number({ error: "Antall må være et helt tall fra 1." })
		.int("Antall må være et helt tall fra 1.")
		.min(1, "Antall må være et helt tall fra 1."),
	totalPriceOre: priceOre,
});

export const productInputSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Skriv et produktnavn.")
		.max(MAX_PRODUCT_NAME_LENGTH, `Produktnavnet kan ha maks ${MAX_PRODUCT_NAME_LENGTH} tegn.`),
	shortDescription: z
		.string()
		.trim()
		.max(
			MAX_SHORT_DESCRIPTION_LENGTH,
			`Kort beskrivelse kan ha maks ${MAX_SHORT_DESCRIPTION_LENGTH} tegn.`,
		),
	longDescription: z
		.string()
		.trim()
		.max(
			MAX_LONG_DESCRIPTION_LENGTH,
			`Lang beskrivelse kan ha maks ${MAX_LONG_DESCRIPTION_LENGTH} tegn.`,
		),
	category: z.enum(PRODUCT_CATEGORIES),
	unitPriceOre: priceOre.optional(),
	vatRate: z
		.number({ error: "Mva må være en prosent mellom 0 og 100." })
		.int("Mva må være en prosent mellom 0 og 100.")
		.min(0, "Mva må være en prosent mellom 0 og 100.")
		.max(100, "Mva må være en prosent mellom 0 og 100."),
	volumeTiers: z
		.array(volumeTierSchema)
		.min(1, tiersMessage)
		.max(MAX_VOLUME_TIERS, tiersMessage)
		.refine(
			(tiers) => new Set(tiers.map((tier) => tier.quantity)).size === tiers.length,
			tiersMessage,
		)
		.transform((tiers) => [...tiers].sort((a, b) => a.quantity - b.quantity))
		.optional(),
	startupPriceOre: priceOre.optional(),
	maxStudents: z
		.number({ error: "Maks antall studenter må være et helt tall fra 1." })
		.int("Maks antall studenter må være et helt tall fra 1.")
		.min(1, "Maks antall studenter må være et helt tall fra 1.")
		.max(MAX_STUDENTS, `Maks antall studenter kan være opptil ${MAX_STUDENTS}.`)
		.optional(),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ValidProductInput = z.output<typeof productInputSchema>;
