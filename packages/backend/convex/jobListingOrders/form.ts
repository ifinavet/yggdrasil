import { ConvexError, v } from "convex/values";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { findCompanyLogoUrl } from "../companies/helper";
import { volumeTier } from "../products/schema";
import { orderRateLimiter } from "./rateLimits";

const COMPANY_LIST_LIMIT = 500;

export async function findListingProduct(ctx: QueryCtx) {
	const active = await ctx.db
		.query("products")
		.withIndex("by_active_and_sortOrder", (q) => q.eq("active", true))
		.take(100);
	return active.find((product) => product.category === "job_listing") ?? null;
}

export const companies = query({
	args: {},
	returns: v.array(v.object({ _id: v.id("companies"), name: v.string() })),
	handler: async (ctx) => {
		const rows = await ctx.db.query("companies").take(COMPANY_LIST_LIMIT);
		return rows
			.map(({ _id, name }) => ({ _id, name }))
			.sort((a, b) => a.name.localeCompare(b.name, "nb"));
	},
});

export const companyCard = query({
	args: { companyId: v.id("companies") },
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("companies"),
			name: v.string(),
			orgNumber: v.number(),
			description: v.string(),
			logoUrl: v.union(v.string(), v.null()),
			hasBilling: v.boolean(),
		}),
	),
	handler: async (ctx, { companyId }) => {
		const company = await ctx.db.get(companyId);
		if (!company) return null;
		return {
			_id: company._id,
			name: company.name,
			orgNumber: company.orgNumber,
			description: company.description,
			logoUrl: await findCompanyLogoUrl(ctx, company._id),
			hasBilling: company.billing !== undefined,
		};
	},
});

export const product = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("products"),
			name: v.string(),
			shortDescription: v.string(),
			volumeTiers: v.array(volumeTier),
			startupPriceOre: v.optional(v.number()),
		}),
	),
	handler: async (ctx) => {
		const found = await findListingProduct(ctx);
		if (!found) return null;
		return {
			_id: found._id,
			name: found.name,
			shortDescription: found.shortDescription,
			volumeTiers: found.volumeTiers ?? [],
			startupPriceOre: found.startupPriceOre,
		};
	},
});

export const generateLogoUploadUrl = mutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		const limit = await orderRateLimiter.limit(ctx, "jobListingOrderLogoUpload");
		if (!limit.ok) throw new ConvexError("Det er lastet opp mange filer. Prøv igjen senere.");
		return await ctx.storage.generateUploadUrl();
	},
});
