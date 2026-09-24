import { isValidOrgNumber, normalizeOrgNumber } from "@workspace/shared/semester/orgNumber";
import { ConvexError, v } from "convex/values";
import { action } from "../../_generated/server";
import { rateLimiter } from "../rateLimits";
import { blockedReason } from "../schema";
import {
	type BrregHit,
	fetchBrregUnit,
	RegistryUnavailableError,
	searchBrregUnits,
} from "./client";
import { RATE_LIMITED_MESSAGE, REGISTRY_UNAVAILABLE_MESSAGE } from "./messages";

/** A search query must be at least this long, and at most MAX_QUERY_LENGTH. */
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

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
		if (trimmed.length < MIN_QUERY_LENGTH || trimmed.length > MAX_QUERY_LENGTH) {
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
