import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Fetches all resources grouped by tag alongside unpublished resources.
 *
 * @returns {{ groupedByTag: Record<string, Doc<"resources">[]>, unpublishedResources: Doc<"resources">[] }} - Published resources grouped by tag and the unpublished resources list.
 */
export const getAllGroupedByTag = query({
    handler: async (ctx) => {
        const resources = await ctx.db.query("resources").collect();

        const publishedResources = resources.filter((resource) => resource.published);
        const unpublishedResources = resources.filter((resource) => !resource.published);

        const groupedByTag = publishedResources.reduce(
            (acc, resource) => {
                const tag = resource.tag || "uncategorized";
                if (!acc[tag]) {
                    acc[tag] = [];
                }
                acc[tag].push(resource);
                return acc;
            },
            {} as Record<string, typeof publishedResources>,
        );

        return { groupedByTag, unpublishedResources };
    },
});

/**
 * Fetches a resource by id.
 *
 * @param {Id<"resources">} id - The id of the resource to fetch.
 *
 * @throws - An error if the resource does not exist.
 * @returns {Doc<"resources">} - The matching resource document.
 */
export const getResourceById = query({
    args: { id: v.id("resources") },
    handler: async (ctx, args) => {
        const resource = await ctx.db.get(args.id);
        if (!resource) {
            throw new Error("Resource not found");
        }
        return resource;
    },
});

/**
 * Fetches an external page by id.
 *
 * @param {Id<"externalPages">} id - The id of the external page to fetch.
 *
 * @throws - An error if the page does not exist.
 * @returns {Doc<"externalPages">} - The matching external page document.
 */
export const getExternalPageById = query({
    args: {
        id: v.id("externalPages"),
    },
    handler: async (ctx, { id }) => {
        const page = await ctx.db.get(id);
        if (!page) {
            throw new Error("Page not found");
        }
        return page;
    },
});

/**
 * Fetches all favorite resources ordered by most recently updated.
 *
 * @returns {Doc<"resources">[]} - The list of favorite resources.
 */
export const getFavorites = query({
    handler: async (ctx) => {
        const resources = await ctx.db
            .query("resources")
            .withIndex("by_favoriteAndUpdated", (q) => q.eq("favorite", true))
            .order("desc")
            .collect();

        return resources;
    },
});

/**
 * Fetches all external pages.
 *
 * @returns {Doc<"externalPages">[]} - All external page documents.
 */
export const getAll = query({
    handler: async (ctx) => {
        const externalPages = await ctx.db.query("externalPages").collect();
        return externalPages;
    },
});

/**
 * Fetches an external page by its identifier.
 *
 * @param {string} identifier - The identifier to look up.
 *
 * @throws - An error if the page does not exist.
 * @returns {Doc<"externalPages">} - The matching external page document.
 */
export const getByIdentifier = query({
    args: {
        identifier: v.string(),
    },
    handler: async (ctx, { identifier }) => {
        const page = await ctx.db
            .query("externalPages")
            .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
            .first();

        if (!page) {
            throw new Error("Page not found");
        }

        return page;
    },
});
