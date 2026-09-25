import { jobListingSales, type ProductCategory, type Sale } from "@workspace/shared/products";
import { eventSemesterOf } from "@workspace/shared/time";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { getProductOrThrow } from "./helpers";

export const MAX_SOLD_ITEMS = 4000;

async function companyNames(ctx: QueryCtx, ids: Iterable<Id<"companies">>) {
	const names = new Map<string, string>();
	for (const id of new Set(ids)) {
		const company = await ctx.db.get(id);
		names.set(id, company?.name ?? "Ukjent bedrift");
	}
	return names;
}

async function productCategories(ctx: QueryCtx, ids: Iterable<Id<"products">>) {
	const categories = new Map<string, ProductCategory>();
	for (const id of new Set(ids)) {
		const product = await ctx.db.get(id);
		categories.set(id, product?.category ?? "other");
	}
	return categories;
}

async function eventSales(
	ctx: QueryCtx,
	events: readonly Doc<"events">[],
	names: Map<string, string>,
): Promise<Sale[]> {
	const sold = events.flatMap((event) =>
		event.product ? [{ event, product: event.product }] : [],
	);
	const categories = await productCategories(
		ctx,
		sold.map(({ product }) => product.productId),
	);
	return sold.map(({ event, product }) => ({
		...eventSemesterOf(event.eventStart),
		productId: product.productId,
		productName: product.name,
		category: categories.get(product.productId) as ProductCategory,
		companyId: event.hostingCompany,
		companyName: names.get(event.hostingCompany) as string,
		quantity: 1,
		revenueOre: product.unitPriceOre ?? 0,
		guessed: event.productGuessed ?? false,
		soldAt: event.eventStart,
	}));
}

async function listingSales(
	ctx: QueryCtx,
	listings: readonly Doc<"jobListings">[],
	names: Map<string, string>,
): Promise<Sale[]> {
	const byProduct = new Map<Id<"products">, Doc<"jobListings">[]>();
	for (const listing of listings) {
		if (!listing.product) continue;
		const group = byProduct.get(listing.product.productId) ?? [];
		group.push(listing);
		byProduct.set(listing.product.productId, group);
	}

	const sales: Sale[] = [];
	for (const [productId, productListings] of byProduct) {
		const product = await getProductOrThrow(ctx, productId);
		sales.push(
			...jobListingSales(
				productListings.map((listing) => ({
					...eventSemesterOf(listing.deadline),
					companyId: listing.company,
					companyName: names.get(listing.company) as string,
					soldAt: listing.deadline,
					guessed: listing.productGuessed ?? false,
				})),
				{
					productId,
					productName: product.name,
					category: product.category,
					volumeTiers: product.volumeTiers ?? [],
				},
			),
		);
	}
	return sales;
}

export const sales = query({
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		const events = await ctx.db
			.query("events")
			.withIndex("by_eventStart")
			.order("desc")
			.take(MAX_SOLD_ITEMS);
		const listings = await ctx.db
			.query("jobListings")
			.withIndex("by_deadline")
			.order("desc")
			.take(MAX_SOLD_ITEMS);
		const names = await companyNames(ctx, [
			...events.map((event) => event.hostingCompany),
			...listings.map((listing) => listing.company),
		]);

		return [
			...(await eventSales(ctx, events, names)),
			...(await listingSales(ctx, listings, names)),
		];
	},
});
