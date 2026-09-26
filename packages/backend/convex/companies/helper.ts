import { logoProblem } from "@workspace/shared/logo";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function requireLogo(ctx: QueryCtx, id: string): Promise<Id<"_storage">> {
	const storageId = ctx.db.system.normalizeId("_storage", id);
	const file = storageId ? await ctx.db.system.get("_storage", storageId) : null;
	if (!storageId || !file) throw new ConvexError("Last opp logoen på nytt.");
	const problem = logoProblem(file.contentType, file.size);
	if (problem) throw new ConvexError(problem);
	return storageId;
}

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
