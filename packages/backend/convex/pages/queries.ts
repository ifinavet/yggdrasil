import { v } from "convex/values";
import { query } from "../_generated/server";

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

export const getAll = query({
    handler: async (ctx) => {
        const externalPages = await ctx.db.query("externalPages").collect();
        return externalPages;
    },
});


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