import { jobListingSales, type Sale } from "@workspace/shared/products";
import { eventSemesterOf } from "@workspace/shared/time";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { getProductOrThrow } from "./helpers";

export const MAX_SOLD_ITEMS = 4000;

type CompanyInfo = { name: string; mainSponsor: boolean; excluded: boolean };

async function companyInfo(ctx: QueryCtx, ids: Iterable<Id<"companies">>) {
	const companies = new Map<string, CompanyInfo>();
	for (const id of new Set(ids)) {
		const company = await ctx.db.get(id);
		companies.set(id, {
			name: company?.name ?? "Ukjent bedrift",
			mainSponsor: company?.mainSponsor ?? false,
			excluded: company?.excludedFromRevenue ?? false,
		});
	}
	return companies;
}

async function eventSales(
	events: readonly Doc<"events">[],
	companies: Map<string, CompanyInfo>,
): Promise<Sale[]> {
	const sold = events.flatMap((event) =>
		event.product ? [{ event, product: event.product }] : [],
	);
	return sold.map(({ event, product }) => {
		const company = companies.get(event.hostingCompany) as CompanyInfo;
		return {
			...eventSemesterOf(event.eventStart),
			productId: product.productId,
			productName: product.name,
			category: event.externalEvent ? "external_event" : "event",
			companyId: event.hostingCompany,
			companyName: company.name,
			excluded: company.excluded,
			quantity: 1,
			revenueOre: company.mainSponsor ? 0 : (product.unitPriceOre ?? 0),
			guessed: event.productGuessed ?? false,
			soldAt: event.eventStart,
		};
	});
}

async function listingSales(
	ctx: QueryCtx,
	listings: readonly Doc<"jobListings">[],
	companies: Map<string, CompanyInfo>,
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
				productListings.map((listing) => {
					const company = companies.get(listing.company) as CompanyInfo;
					return {
						...eventSemesterOf(listing.publishedAt ?? listing._creationTime),
						companyId: listing.company,
						companyName: company.name,
						excluded: company.excluded,
						soldAt: listing.publishedAt ?? listing._creationTime,
						guessed: listing.productGuessed ?? false,
					};
				}),
				{
					productId,
					productName: product.name,
					category: "job_listing",
					volumeTiers: product.volumeTiers ?? [],
				},
			).map((sale) => ({
				...sale,
				revenueOre: companies.get(sale.companyId)?.mainSponsor ? 0 : sale.revenueOre,
			})),
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
		const companies = await companyInfo(ctx, [
			...events.map((event) => event.hostingCompany),
			...listings.map((listing) => listing.company),
		]);

		return [
			...(await eventSales(events, companies)),
			...(await listingSales(ctx, listings, companies)),
		];
	},
});
