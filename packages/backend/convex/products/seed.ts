import { DEFAULT_VAT_RATE, kronerToOre, type ProductCategory } from "@workspace/shared/products";
import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { diffProduct, recordChange } from "./helpers";

type SeedProduct = Omit<WithoutSystemFields<Doc<"products">>, "sortOrder" | "active" | "vatRate">;

function eventProduct(
	name: string,
	category: ProductCategory,
	priceKroner: number | undefined,
	paragraphs: string[],
	maxStudents?: number,
): SeedProduct {
	return {
		name,
		shortDescription: "",
		longDescription: paragraphs.join("\n\n"),
		category,
		unitPriceOre: priceKroner === undefined ? undefined : kronerToOre(priceKroner),
		maxStudents,
	};
}

export const SEED_PRODUCTS: readonly SeedProduct[] = [
	eventProduct("Stor bedriftspresentasjon", "event", 40_000, [
		"En større bedriftspresentasjon holdes enten ved IFI eller i deres egne lokaler. Dere velger ønsket antall studenter selv, uten begrensninger.",
		"Dere bestemmer selv innholdet og vi kan rådføre ved behov. Vanligvis holder bedriften presentasjon i 45-60 minutter, før vi går videre til mingling, mat og drikke.",
	]),
	eventProduct(
		"Ordinær bedriftspresentasjon",
		"event",
		30_000,
		[
			"Her gjelder samme vilkår som ved stor bedriftspresentasjon, men med en antallsbegrensing på 40 studenter.",
		],
		40,
	),
	eventProduct(
		"Bedriftspresentasjon med fokus på faglig innhold",
		"event",
		20_000,
		[
			"Denne typen presentasjon har en satt begrensning på maks 10 minutter presentasjon, etterfulgt av annet faglig innhold, eventuelt workshop.",
			"Varighet for arrangementet avhenger av hva dere ønsker å gjennomføre. Av erfaring bør dette ikke vare særlig mer enn 1,5 time uten å ha noen form for matservering underveis. Dere står fritt til å velge innhold selv og gi gjerne en beskrivelse av hva dere ønsker å gjennomføre i søknaden deres. Maks 40 studenter.",
		],
		40,
	),
	eventProduct("Sosialt arrangement", "event", undefined, []),
	eventProduct("Eksterne arrangementer", "external_event", 15_000, [
		'Eksterne arrangementer er aktiviteter gjennomført og organisert av bedriften uavhengig av Navet. Promotering vil skje via ifinavet.no under fanen "Eksterne arrangementer" og på Instagram hvor dere vil få to storyer.',
		"Det at arrangementet er uavhengig av Navet betyr at Navet kun stiller med promotering av arrangementet. Navet deltar ikke i organiseringen eller påmelding av arrangementet, aktiviteten skal ikke ta plass på IFI, det kan ikke foregå på tirsdager og torsdager og arrangementet kan ikke etterligne det en bedriftspresentasjon tilbyr for studenter.",
		"Navet forebeholder seg retten til å avslå alle forespørsler om promotering av eksterne arrangementer.",
	]),
	{
		name: "Stillingsannonse",
		shortDescription: "",
		longDescription: "",
		category: "job_listing",
		volumeTiers: [
			{ quantity: 1, totalPriceOre: kronerToOre(3_000) },
			{ quantity: 2, totalPriceOre: kronerToOre(5_500) },
			{ quantity: 3, totalPriceOre: kronerToOre(7_500) },
		],
		startupPriceOre: kronerToOre(500),
	},
];

export const seedProducts = internalMutation({
	handler: async (ctx) => {
		const inserted: string[] = [];
		for (const [sortOrder, seed] of SEED_PRODUCTS.entries()) {
			const existing = await ctx.db
				.query("products")
				.withIndex("by_name", (q) => q.eq("name", seed.name))
				.first();
			if (existing) continue;

			const product = { ...seed, vatRate: DEFAULT_VAT_RATE, sortOrder, active: true };
			const productId = await ctx.db.insert("products", product);
			await recordChange(ctx, { productId, action: "created", changes: diffProduct({}, product) });
			inserted.push(seed.name);
		}
		return inserted;
	},
});
