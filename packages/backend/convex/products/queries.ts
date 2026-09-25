import { v } from "convex/values";
import { query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { MAX_PRODUCTS } from "./helpers";

const MAX_CHANGES_SHOWN = 50;

export const listActive = query({
	handler: async (ctx) => {
		return await ctx.db
			.query("products")
			.withIndex("by_active_and_sortOrder", (q) => q.eq("active", true))
			.take(MAX_PRODUCTS);
	},
});

export const listAll = query({
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		return await ctx.db.query("products").withIndex("by_sortOrder").take(MAX_PRODUCTS);
	},
});

export const getWithChanges = query({
	args: { id: v.id("products") },
	handler: async (ctx, { id }) => {
		await requireRole(ctx, adminRoles);
		const product = await ctx.db.get(id);
		if (product === null) return null;
		const changes = await ctx.db
			.query("productChanges")
			.withIndex("by_productId", (q) => q.eq("productId", id))
			.order("desc")
			.take(MAX_CHANGES_SHOWN);

		const changesWithAuthor = await Promise.all(
			changes.map(async (change) => {
				const author = change.changedBy ? await ctx.db.get(change.changedBy) : null;
				return {
					...change,
					changedByName: author ? `${author.firstName} ${author.lastName}` : null,
				};
			}),
		);

		return { product, changes: changesWithAuthor };
	},
});
