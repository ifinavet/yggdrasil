import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAll = query({
  handler: async (ctx) => {
    const externalPages = await ctx.db.query("externalPages").collect();
    return externalPages;
  },
});

export const getById = query({
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

export const update = mutation({
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

    const page = await ctx.db.get(id);
    if (!page) {
      throw new Error("Page not found");
    }

    await ctx.db.patch(id, {
      ...page,
      title,
      content,
      published,
      updatedAt: Date.now(),
    });
  },
});

export const create = mutation({
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

    await ctx.db.insert("externalPages", {
      title,
      content,
      published,
      updatedAt: Date.now(),
    });
  },
});
