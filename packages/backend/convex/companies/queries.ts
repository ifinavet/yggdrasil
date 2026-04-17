import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Fetches paginated companies.
 *
 * @param {PaginationOptions} paginationOpts - The Convex pagination options.
 *
 * @returns {PaginationResult<Doc<"companies">>} - The paginated companies result.
 */
export const getAllPaged = query({
    args: { paginationOpts: paginationOptsValidator },
    handler: async (ctx, { paginationOpts }) => {
        const companies = await ctx.db.query("companies").paginate(paginationOpts);
        return companies;
    },
});

/**
 * Fetches all companies.
 *
 * @returns {Doc<"companies">[]} - All company documents.
 */
export const getAll = query({
    handler: async (ctx) => {
        return await ctx.db.query("companies").collect();
    },
});

/**
 * Fetches the current main sponsor with its resolved logo URL.
 *
 * @throws - An error if the main sponsor logo or logo URL cannot be resolved.
 * @returns {(Doc<"companies"> & { imageUrl: string }) | null} - The main sponsor with image URL, or null if none is set.
 */
export const getMainSponsor = query({
    handler: async (ctx) => {
        const mainSponsor = await ctx.db
            .query("companies")
            .filter((q) => q.eq(q.field("mainSponsor"), true))
            .first();

        if (!mainSponsor) return null;

        const companyImage = await ctx.db.get(mainSponsor.logo);
        if (!companyImage) {
            throw new Error(`Company logo with ID ${mainSponsor.logo} not found`);
        }

        const imageUrl = await ctx.storage.getUrl(companyImage.image);
        if (!imageUrl) {
            throw new Error(`Image URL for logo with ID ${companyImage.image} not found`);
        }

        return { ...mainSponsor, imageUrl };
    },
});

/**
 * Fetches a company by id with its resolved logo URL.
 *
 * @param {Id<"companies">} id - The id of the company to fetch.
 *
 * @throws - An error if the company, logo, or logo URL cannot be resolved.
 * @returns {Doc<"companies"> & { imageUrl: string }} - The company with image URL.
 */
export const getById = query({
    args: {
        id: v.id("companies"),
    },
    handler: async (ctx, { id }) => {
        const company = await ctx.db.get(id);
        if (!company) {
            throw new Error(`Company with ID ${id} not found`);
        }

        const companyImage = await ctx.db.get(company.logo);
        if (!companyImage) {
            throw new Error(`Company logo with ID ${company.logo} not found`);
        }

        const imageUrl = await ctx.storage.getUrl(companyImage.image);
        if (!imageUrl) {
            throw new Error(`Image URL for logo with ID ${companyImage.image} not found`);
        }

        return { ...company, imageUrl };
    },
});

/**
 * Searches companies by name.
 *
 * @param {string} searchQuery - The search string to match against company names.
 *
 * @returns {Doc<"companies">[]} - Up to ten matching companies.
 */
export const searchByName = query({
    args: {
        searchQuery: v.string(),
    },
    handler: async (ctx, { searchQuery }) => {
        return await ctx.db
            .query("companies")
            .withSearchIndex("search_name", (q) => q.search("name", searchQuery))
            .take(10);
    },
});

/**
 * Fetches paginated company logos with resolved image URLs.
 *
 * @param {PaginationOptions} paginationOpts - The Convex pagination options.
 *
 * @throws - An error if any logo image URL cannot be resolved.
 * @returns {PaginationResult<Doc<"companyLogos"> & { imageUrl: string }>} - The paginated logos result.
 */
export const getCompanyLogosPaged = query({
    args: { paginationOpts: paginationOptsValidator },
    handler: async (ctx, { paginationOpts }) => {
        const logos = await ctx.db.query("companyLogos").paginate(paginationOpts);

        const logosWithImages = await Promise.all(
            logos.page.map(async (logo) => {
                const imageUrl = await ctx.storage.getUrl(logo.image);
                if (!imageUrl) {
                    throw new Error(`Image URL for logo with ID ${logo.image} not found`);
                }

                return {
                    ...logo,
                    imageUrl,
                };
            }),
        );

        return {
            ...logos,
            page: logosWithImages,
        };
    },
});

/**
 * Fetches a company logo by id with its resolved image URL.
 *
 * @param {Id<"companyLogos"> | undefined} id - The optional id of the company logo to fetch.
 *
 * @throws - An error if the logo or logo URL cannot be resolved.
 * @returns {(Doc<"companyLogos"> & { imageUrl: string }) | null} - The logo with image URL, or null when no id is provided.
 */
export const getCompanyLogoById = query({
    args: {
        id: v.optional(v.id("companyLogos")),
    },
    handler: async (ctx, { id }) => {
        if (!id) {
            return null;
        }

        const logo = await ctx.db.get(id);
        if (!logo) {
            throw new Error(`Company logo with ID ${id} not found`);
        }

        const imageUrl = await ctx.storage.getUrl(logo.image);
        if (!imageUrl) {
            throw new Error(`Image URL for logo with ID ${logo.image} not found`);
        }

        return { ...logo, imageUrl };
    },
});
