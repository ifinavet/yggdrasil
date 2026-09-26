import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { orderRateLimiter } from "./rateLimits";

export const MIN_ADDRESS_QUERY_LENGTH = 3;
const MAX_ADDRESS_QUERY_LENGTH = 100;
const MAX_SUGGESTIONS = 8;
const TIMEOUT_MS = 4000;
const GEONORGE_SEARCH_URL = "https://ws.geonorge.no/adresser/v1/sok";

function readText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function formatGeonorgeAddresses(body: unknown): string[] {
	if (typeof body !== "object" || body === null) return [];
	const hits = (body as { adresser?: unknown }).adresser;
	if (!Array.isArray(hits)) return [];

	const addresses = hits.flatMap((hit: unknown) => {
		if (typeof hit !== "object" || hit === null) return [];
		const record = hit as Record<string, unknown>;
		const street = readText(record.adressetekst);
		const place = [readText(record.postnummer), readText(record.poststed)]
			.filter(Boolean)
			.join(" ");
		if (!street) return [];
		return [place ? `${street}, ${place}` : street];
	});
	return [...new Set(addresses)];
}

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
		return formatGeonorgeAddresses(await response.json());
	} catch {
		return [];
	}
}

export const searchAddresses = action({
	args: { query: v.string() },
	returns: v.array(v.string()),
	handler: async (ctx, { query }): Promise<string[]> => {
		const trimmed = query.trim();
		if (trimmed.length < MIN_ADDRESS_QUERY_LENGTH || trimmed.length > MAX_ADDRESS_QUERY_LENGTH) {
			throw new ConvexError("Skriv minst tre tegn.");
		}

		const { ok } = await orderRateLimiter.limit(ctx, "jobListingOrderAddressSearch");
		if (!ok) return [];

		return fetchGeonorgeAddresses(trimmed);
	},
});
