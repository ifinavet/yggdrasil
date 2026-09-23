import { ConvexError, v } from "convex/values";
import { action } from "../../_generated/server";
import { rateLimiter } from "../rateLimits";
import { isValidOrgNumber, normalizeOrgNumber } from "../rules";
import { peppolLookup } from "../schema";
import {
	type BrregHit,
	checkPeppol,
	fetchBrregUnit,
	REGISTRY_UNAVAILABLE_MESSAGE,
	RegistryUnavailableError,
	searchBrregUnits,
} from "./client";

const RATE_LIMITED_MESSAGE = "Det er mange søk akkurat nå. Prøv igjen om litt.";

const blockedReason = v.union(
	v.literal("deleted"),
	v.literal("bankrupt"),
	v.literal("liquidation"),
);

/**
 * Searches Enhetsregisteret for the Hugin company picker. Public: it only returns what brreg
 * publishes. A nine-digit query is treated as an organization number.
 *
 * @param {string} query - A company name or organization number.
 *
 * @throws - An error if the query is too short or long, the search is rate limited, or brreg
 * does not answer.
 * @returns {BrregHit[]} - Up to ten hits, with a reason when a company cannot apply.
 */
export const searchCompanies = action({
	args: { query: v.string() },
	returns: v.array(
		v.object({
			orgNumber: v.string(),
			name: v.string(),
			organizationForm: v.string(),
			city: v.optional(v.string()),
			blockedReason: v.optional(blockedReason),
		}),
	),
	handler: async (ctx, { query }): Promise<BrregHit[]> => {
		const trimmed = query.trim();
		if (trimmed.length < 2 || trimmed.length > 100) {
			throw new ConvexError("Skriv minst to tegn.");
		}

		const { ok } = await rateLimiter.limit(ctx, "brregSearch");
		if (!ok) throw new ConvexError(RATE_LIMITED_MESSAGE);

		try {
			const orgNumber = normalizeOrgNumber(trimmed);
			if (/^\d{9}$/.test(orgNumber)) {
				if (!isValidOrgNumber(orgNumber)) return [];
				const lookup = await fetchBrregUnit(orgNumber, Date.now());
				if (lookup.status === "not_found") return [];

				const city = lookup.snapshot.businessAddress?.city;
				return [
					{
						orgNumber,
						name: lookup.snapshot.name,
						organizationForm: lookup.snapshot.organizationForm.description,
						...(city ? { city } : {}),
						...(lookup.blockedReason ? { blockedReason: lookup.blockedReason } : {}),
					},
				];
			}

			return await searchBrregUnits(trimmed);
		} catch (error) {
			if (error instanceof RegistryUnavailableError) {
				throw new ConvexError(REGISTRY_UNAVAILABLE_MESSAGE);
			}
			throw error;
		}
	},
});

/**
 * Checks whether a company can receive EHF invoices, to prefill the invoice question on Hugin.
 *
 * @param {string} orgNumber - The organization number.
 *
 * @throws - An error if the number is invalid or the lookup is rate limited.
 * @returns {"found" | "not_found" | "failed"} - The Peppol Directory result.
 */
export const lookupPeppol = action({
	args: { orgNumber: v.string() },
	returns: peppolLookup,
	handler: async (ctx, { orgNumber }) => {
		const normalized = normalizeOrgNumber(orgNumber);
		if (!isValidOrgNumber(normalized)) {
			throw new ConvexError("Organisasjonsnummeret er ugyldig.");
		}

		const { ok } = await rateLimiter.limit(ctx, "peppolLookup");
		if (!ok) throw new ConvexError(RATE_LIMITED_MESSAGE);

		return checkPeppol(normalized);
	},
});
