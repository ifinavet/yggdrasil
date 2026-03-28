import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Creates a new resource page.
 *
 * @param {string} title - The resource title.
 * @param {string} excerpt - The resource excerpt.
 * @param {string} content - The resource body content.
 * @param {string | undefined} tag - The optional resource tag.
 * @param {string} icon - The icon name to store with the resource.
 * @param {string} gradient - The gradient token used for display.
 * @param {boolean} published - Whether the resource should be publicly visible.
 *
 * @throws - An error if the mutation is called without an authenticated user.
 * @returns {null} - Returns null when the resource is created successfully.
 */
export const createResource = mutation({
    args: {
        title: v.string(),
        excerpt: v.string(),
        content: v.string(),
        tag: v.optional(v.string()),
        icon: v.string(),
        gradient: v.string(),
        published: v.boolean(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        await ctx.db.insert("resources", {
            title: args.title,
            excerpt: args.excerpt,
            content: args.content,
            tag: args.tag,
            favorite: false,
            icon: args.icon,
            gradient: args.gradient,
            published: args.published,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Updates an existing resource page.
 *
 * @param {Id<"resources">} id - The id of the resource to update.
 * @param {string} title - The updated resource title.
 * @param {string} excerpt - The updated resource excerpt.
 * @param {string} content - The updated resource body content.
 * @param {string | undefined} tag - The updated optional resource tag.
 * @param {string} icon - The updated icon name.
 * @param {boolean} published - Whether the resource should be publicly visible.
 *
 * @throws - An error if the mutation is called without an authenticated user.
 * @returns {null} - Returns null when the resource is updated successfully.
 */
export const updateResource = mutation({
    args: {
        id: v.id("resources"),
        title: v.string(),
        excerpt: v.string(),
        content: v.string(),
        tag: v.optional(v.string()),
        icon: v.string(),
        published: v.boolean(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        await ctx.db.patch(args.id, {
            title: args.title,
            excerpt: args.excerpt,
            content: args.content,
            tag: args.tag,
            icon: args.icon,
            published: args.published,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Updates an existing external page and regenerates its identifier.
 *
 * @param {Id<"externalPages">} id - The id of the external page to update.
 * @param {string} title - The updated page title.
 * @param {string} content - The updated page content.
 * @param {boolean} published - Whether the page should be publicly visible.
 *
 * @throws - An error if the mutation is called without an authenticated user.
 * @returns {null} - Returns null when the external page is updated successfully.
 */
export const updateExternalPage = mutation({
    args: {
        id: v.id("externalPages"),
        title: v.string(),
        content: v.string(),
        published: v.boolean(),
    },
    handler: async (ctx, { id, title, content, published }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        const identifier = title
            .toLowerCase()
            .replaceAll(/[æøå]/g, (match) => {
                switch (match) {
                    case "æ":
                        return "ae";
                    case "ø":
                        return "o";
                    case "å":
                        return "a";
                    default:
                        return match;
                }
            })
            .replaceAll(/\s+/g, "-");

        await ctx.db.patch(id, {
            title,
            identifier,
            content,
            published,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Creates a new external page and generates its identifier from the title.
 *
 * @param {string} title - The page title.
 * @param {string} content - The page content.
 * @param {boolean} published - Whether the page should be publicly visible.
 *
 * @throws - An error if the mutation is called without an authenticated user.
 * @returns {null} - Returns null when the external page is created successfully.
 */
export const createExternalPage = mutation({
    args: {
        title: v.string(),
        content: v.string(),
        published: v.boolean(),
    },
    handler: async (ctx, { title, content, published }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        const identifier = title
            .toLowerCase()
            .replaceAll(/[æøå]/g, (match) => {
                switch (match) {
                    case "æ":
                        return "ae";
                    case "ø":
                        return "o";
                    case "å":
                        return "a";
                    default:
                        return match;
                }
            })
            .replaceAll(/\s+/g, "-");

        await ctx.db.insert("externalPages", {
            identifier,
            title,
            content,
            published,
            updatedAt: Date.now(),
        });
    },
});
