import { addressQuerySchema, geonorgeAddressesSchema } from "@workspace/shared/job-listing-orders";
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { orderRateLimiter } from "./rateLimits";

const MAX_SUGGESTIONS = 8;
const TIMEOUT_MS = 4000;
const GEONORGE_SEARCH_URL = "https://ws.geonorge.no/adresser/v1/sok";

async function fetchGeonorgeAddresses(query: string): Promise<string[]> {
	const url = new URL(GEONORGE_SEARCH_URL);
	url.searchParams.set("sok", query);
	url.searchParams.set("fuzzy", "true");
	url.searchParams.set("treffPerSide", String(MAX_SUGGESTIONS));
	url.searchParams.set("filtrer", "adresser.adressetekst,adresser.postnummer,adresser.poststed");

	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) return [];
		const parsed = geonorgeAddressesSchema.safeParse(await response.json());
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

export const searchAddresses = action({
	args: { query: v.string() },
	returns: v.array(v.string()),
	handler: async (ctx, { query }): Promise<string[]> => {
		const parsed = addressQuerySchema.safeParse(query);
		if (!parsed.success) throw new ConvexError("Skriv minst tre tegn.");

		const { ok } = await orderRateLimiter.limit(ctx, "jobListingOrderAddressSearch");
		if (!ok) return [];

		return fetchGeonorgeAddresses(parsed.data);
	},
});
