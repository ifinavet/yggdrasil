import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import {
	diffProduct,
	getProductOrThrow,
	MAX_PRODUCTS,
	nextSortOrder,
	parseProductInput,
	recordChange,
	requireUniqueName,
} from "./helpers";
import { seedAndBackfillProducts } from "./migrations";
import { productFields } from "./schema";

const clearedOptionalFields = {
	unitPriceOre: undefined,
	volumeTiers: undefined,
	startupPriceOre: undefined,
	maxStudents: undefined,
};

export const create = mutation({
	args: productFields,
	handler: async (ctx, args) => {
		const admin = await requireRole(ctx, adminRoles);
		const existing = await ctx.db.query("products").withIndex("by_sortOrder").take(MAX_PRODUCTS);
		if (existing.length >= MAX_PRODUCTS) {
			throw new ConvexError("Maksimalt antall produkter er nådd.");
		}
		const input = parseProductInput(args);
		await requireUniqueName(ctx, input.name);

		const product = { ...input, sortOrder: await nextSortOrder(ctx), active: true };
		const productId = await ctx.db.insert("products", product);
		await recordChange(ctx, {
			productId,
			changedBy: admin._id,
			action: "created",
			changes: diffProduct({}, product),
		});

		return productId;
	},
});

export const update = mutation({
	args: { id: v.id("products"), ...productFields },
	handler: async (ctx, { id, ...args }) => {
		const admin = await requireRole(ctx, adminRoles);
		const before = await getProductOrThrow(ctx, id);
		const input = parseProductInput(args);
		await requireUniqueName(ctx, input.name, id);

		const replacement = { ...clearedOptionalFields, ...input };
		await ctx.db.patch(id, replacement);
		await recordChange(ctx, {
			productId: id,
			changedBy: admin._id,
			action: "updated",
			changes: diffProduct(before, { ...before, ...replacement }),
		});
	},
});

export const setActive = mutation({
	args: { id: v.id("products"), active: v.boolean() },
	handler: async (ctx, { id, active }) => {
		const admin = await requireRole(ctx, adminRoles);
		const before = await getProductOrThrow(ctx, id);
		if (before.active === active) return;

		await ctx.db.patch(id, { active });
		await recordChange(ctx, {
			productId: id,
			changedBy: admin._id,
			action: active ? "restored" : "archived",
			changes: diffProduct(before, { ...before, active }),
		});
	},
});

export const reorder = mutation({
	args: { ids: v.array(v.id("products")) },
	handler: async (ctx, { ids }) => {
		const admin = await requireRole(ctx, adminRoles);
		const products = await ctx.db.query("products").withIndex("by_sortOrder").take(MAX_PRODUCTS);
		const byId = (a: string, b: string) => a.localeCompare(b);
		const knownIds = products.map((product) => product._id).sort(byId);
		const givenIds = [...ids].sort(byId);
		const coversAllProducts =
			givenIds.length === knownIds.length && givenIds.every((id, index) => id === knownIds[index]);
		if (!coversAllProducts) {
			throw new ConvexError("Rekkefølgen må inneholde alle produktene nøyaktig én gang.");
		}

		for (const before of products) {
			const sortOrder = ids.indexOf(before._id);
			if (before.sortOrder === sortOrder) continue;
			await ctx.db.patch(before._id, { sortOrder });
			await recordChange(ctx, {
				productId: before._id,
				changedBy: admin._id,
				action: "reordered",
				changes: diffProduct(before, { ...before, sortOrder }),
			});
		}
	},
});

export const setup = mutation({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		return await seedAndBackfillProducts(ctx);
	},
});
