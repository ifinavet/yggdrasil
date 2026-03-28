import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentUserOrThrow } from "../auth/currentUser";

/**
 * Generates a temporary upload URL for storing a company logo in Convex storage.
 *
 * @throws - An error if the mutation is tried to be called without the user being authenticated.
 * @returns {string} - A temporary upload URL for the logo file.
 */
export const generateUploadUrl = mutation({
    handler: async (ctx) => {
        await getCurrentUserOrThrow(ctx);

        const uploadUrl = await ctx.storage.generateUploadUrl();

        return uploadUrl;
    },
});

/**
 * Creates a new company logo record from an uploaded storage file.
 *
 * @param {Id<"_storage">} id - The file id for the uploaded logo in Convex storage.
 * @param {string} name - The name to store for the uploaded company logo.
 *
 * @throws - An error if the mutation is tried to be called without the user being authenticated.
 * @returns {Id<"companyLogos">} - The id of the created company logo document.
 */
export const uploadCompanyLogo = mutation({
    args: {
        id: v.id("_storage"),
        name: v.string(),
    },
    handler: async (ctx, { id, name }) => {
        await getCurrentUserOrThrow(ctx);

        const logoId = await ctx.db.insert("companyLogos", {
            name,
            image: id,
        });

        return logoId;
    },
});

/**
 * Creates a company linked to an existing logo.
 *
 * @param {number} orgNumber - The organization number for the company.
 * @param {string} name - The company name.
 * @param {string} description - The company description.
 * @param {Id<"companyLogos">} logo - The id of the company logo document.
 *
 * @throws - An error if the mutation is tried to be called without the user being authenticated.
 * @returns {null} - Returns null when the company is created successfully.
 */
export const create = mutation({
    args: {
        orgNumber: v.number(),
        name: v.string(),
        description: v.string(),
        logo: v.id("companyLogos"),
    },
    handler: async (ctx, { orgNumber, name, description, logo }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.insert("companies", {
            orgNumber,
            name,
            description,
            logo,
            mainSponsor: false,
        });
    },
});

/**
 * Updates an existing company and replaces its core profile fields.
 *
 * @param {Id<"companies">} id - The id of the company to update.
 * @param {number} orgNumber - The updated organization number.
 * @param {string} name - The updated company name.
 * @param {string} description - The updated company description.
 * @param {Id<"companyLogos">} logo - The updated company logo id.
 *
 * @throws - An error if the mutation is tried to be called without the user being authenticated.
 * @returns {null} - Returns null when the company is updated successfully.
 */
export const update = mutation({
    args: {
        id: v.id("companies"),
        orgNumber: v.number(),
        name: v.string(),
        description: v.string(),
        logo: v.id("companyLogos"),
    },
    handler: async (ctx, { id, orgNumber, name, description, logo }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.patch(id, {
            orgNumber,
            name,
            description,
            logo,
        });
    },
});

/**
 * Switches the main sponsor flag to the provided company.
 *
 * @param {Id<"companies">} companyId - The company id that should become the main sponsor.
 *
 * @throws - An error if the mutation is tried to be called without the user being authenticated.
 * @returns {null} - Returns null when the main sponsor is updated successfully.
 */
export const updateMainSponsor = mutation({
    args: {
        companyId: v.id("companies"),
    },
    handler: async (ctx, { companyId: id }) => {
        await getCurrentUserOrThrow(ctx);

        // Unset previous main sponsor
        const previousMainSponsor = await ctx.db
            .query("companies")
            .filter((q) => q.eq(q.field("mainSponsor"), true))
            .first();

        if (previousMainSponsor) {
            await ctx.db.patch(previousMainSponsor._id, { mainSponsor: false });
        }

        // Set new main sponsor
        await ctx.db.patch(id, { mainSponsor: true });
    },
});

/**
 * Deletes a company by id.
 *
 * @param {Id<"companies">} id - The id of the company to delete.
 *
 * @throws - An error if the mutation is tried to be called without the user being authenticated.
 * @returns {null} - Returns null when the company is deleted successfully.
 */
export const remove = mutation({
    args: {
        id: v.id("companies"),
    },
    handler: async (ctx, { id }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.delete(id);
    },
});