import { v } from "convex/values";
import { mutation } from "../_generated/server";

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