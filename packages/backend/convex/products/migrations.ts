import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { migrations } from "../migrations";
import { productOf } from "./helpers";
import { snapshotOf } from "./sales";
import { SEED_PRODUCT_NAMES, seedProductsIfEmpty } from "./seed";

const REGULAR_EVENT_CAP = 40;

export function guessEventProductName(
	event: Pick<Doc<"events">, "externalEvent" | "participationLimit">,
): string {
	if (event.externalEvent) return SEED_PRODUCT_NAMES.externalEvent;
	if (event.participationLimit > REGULAR_EVENT_CAP) return SEED_PRODUCT_NAMES.largeEvent;
	return SEED_PRODUCT_NAMES.regularEvent;
}

async function guessedSnapshot(ctx: MutationCtx, name: string) {
	const product = await ctx.db
		.query("products")
		.withIndex("by_name", (q) => q.eq("name", name))
		.first();
	return product ? { product: snapshotOf(product), productGuessed: true } : undefined;
}

export const backfillEventProducts = migrations.define({
	table: "events",
	migrateOne: async (ctx, event) => {
		if (event.product) return;
		return await guessedSnapshot(ctx, guessEventProductName(event));
	},
});

export const backfillJobListingProducts = migrations.define({
	table: "jobListings",
	migrateOne: async (ctx, listing) => {
		if (listing.product) return;
		return await guessedSnapshot(ctx, SEED_PRODUCT_NAMES.jobListing);
	},
});

const BACKFILLS = [
	internal.products.migrations.backfillEventProducts,
	internal.products.migrations.backfillJobListingProducts,
];

type TypedRow = Pick<Doc<"companyApplications">, "productId" | "eventType">;
type Answers = Doc<"eventPlanning">["answers"];

async function withProduct(ctx: MutationCtx, row: TypedRow) {
	const product = await productOf(ctx, row);
	return product ? { productId: product._id, eventType: undefined } : {};
}

async function withRequestedProduct(ctx: MutationCtx, answers: Answers): Promise<Answers> {
	const { requestedEventType, ...rest } = answers;
	const product = await productOf(ctx, {
		productId: answers.requestedProductId,
		eventType: requestedEventType,
	});
	return product ? { ...rest, requestedProductId: product._id } : answers;
}

export const moveApplicationsToProducts = migrations.define({
	table: "companyApplications",
	migrateOne: withProduct,
});

export const moveOffersToProducts = migrations.define({
	table: "companyApplicationOffers",
	migrateOne: withProduct,
});

export const movePendingApplicationsToProducts = migrations.define({
	table: "pendingCompanyApplications",
	migrateOne: async (ctx, { form }) => {
		const { eventType, ...rest } = form;
		const product = await productOf(ctx, form);
		return product ? { form: { ...rest, productId: product._id } } : {};
	},
});

export const movePlanningToProducts = migrations.define({
	table: "eventPlanning",
	migrateOne: async (ctx, row) => ({
		...(await withProduct(ctx, row)),
		answers: await withRequestedProduct(ctx, row.answers),
	}),
});

export const movePlanningSubmissionsToProducts = migrations.define({
	table: "eventPlanningSubmissions",
	migrateOne: async (ctx, row) => ({
		answers: await withRequestedProduct(ctx, row.answers),
		draft: await withRequestedProduct(ctx, row.draft),
	}),
});

export async function seedAndBackfillProducts(ctx: MutationCtx) {
	const seeded = await seedProductsIfEmpty(ctx);
	if (seeded.length > 0) await migrations.runSerially(ctx, BACKFILLS);
	await migrations.runSerially(ctx, [
		internal.products.migrations.moveApplicationsToProducts,
		internal.products.migrations.moveOffersToProducts,
		internal.products.migrations.movePendingApplicationsToProducts,
		internal.products.migrations.movePlanningToProducts,
		internal.products.migrations.movePlanningSubmissionsToProducts,
	]);
	return seeded;
}
