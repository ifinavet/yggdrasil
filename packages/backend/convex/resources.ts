import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const getById = query({
  args: { id: v.id("resources") },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.id);
    if (!resource) {
      throw new Error("Resource not found");
    }
    return resource;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    excerpt: v.string(),
    content: v.string(),
    tag: v.optional(v.string()),
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
      published: args.published,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("resources"),
    title: v.string(),
    excerpt: v.string(),
    content: v.string(),
    tag: v.optional(v.string()),
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
      published: args.published,
      updatedAt: Date.now(),
    });
  },
});

export const getFavorites = query({
  handler: async (ctx) => {
    const resources = await ctx.db
      .query("resources")
      .withIndex("by_favoriteAndUpdated", (q) => q.eq("favorite", true))
      .order("desc")
      .collect();

    return resources
  },
});
