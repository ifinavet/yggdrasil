import { isEventProduct, type ProductCategory } from "@workspace/shared/products";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_PRODUCTS } from "./helpers";
import type { ProductSnapshot } from "./schema";

type SoldProduct = { product?: ProductSnapshot; productGuessed?: boolean };

export function snapshotOf(product: Doc<"products">): ProductSnapshot {
	return { productId: product._id, name: product.name, unitPriceOre: product.unitPriceOre };
}

export async function eventProductFields(
	ctx: MutationCtx,
	productId: Id<"products"> | undefined,
	current: SoldProduct = {},
): Promise<SoldProduct> {
	if (productId === undefined) return {};
	if (current.product?.productId === productId) {
		return { product: current.product, productGuessed: undefined };
	}

	const product = await ctx.db.get(productId);
	if (!product?.active || !isEventProduct(product)) {
		throw new ConvexError("Velg et aktivt produkt for arrangementer.");
	}
	return { product: snapshotOf(product), productGuessed: undefined };
}

export async function activeProductIn(ctx: MutationCtx, category: ProductCategory) {
	const candidates = await ctx.db
		.query("products")
		.withIndex("by_category", (q) => q.eq("category", category))
		.take(MAX_PRODUCTS);
	return candidates.find((product) => product.active) ?? null;
}

export async function jobListingProductFields(ctx: MutationCtx): Promise<SoldProduct> {
	const product = await activeProductIn(ctx, "job_listing");
	return product ? { product: snapshotOf(product) } : {};
}
