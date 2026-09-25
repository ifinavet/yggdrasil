import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * The URL of a company's logo, or null when the company, its logo or the stored file is missing.
 * Unlike `getById`, it never throws, so a list can show the companies that have a logo.
 *
 * @param {QueryCtx} ctx - The Convex query context.
 * @param {Id<"companies">} companyId - The company profile.
 *
 * @returns {Promise<string | null>} - The logo URL, or null.
 */
export async function findCompanyLogoUrl(
	ctx: QueryCtx,
	companyId: Id<"companies">,
): Promise<string | null> {
	const company = await ctx.db.get(companyId);
	const logo = company ? await ctx.db.get(company.logo) : null;
	return logo ? ctx.storage.getUrl(logo.image) : null;
}
