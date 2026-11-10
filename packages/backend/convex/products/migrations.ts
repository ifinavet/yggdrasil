import { STUDENT_CAP } from "@workspace/shared/semester/application";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { migrations } from "../migrations";
import { productForType, productOf } from "./helpers";
import { snapshotOf } from "./sales";
import { SEED_PRODUCT_NAMES, seedProductsIfEmpty } from "./seed";

const REGULAR_EVENT_CAP = STUDENT_CAP.standard_presentation as number;

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

type Answers = Doc<"eventPlanning">["answers"];

async function withRequestedProduct(ctx: MutationCtx, answers: Answers): Promise<Answers> {
	if (!answers.requestedEventType || answers.requestedProductId) return answers;
	const product = await productForType(ctx, answers.requestedEventType);
	return { ...answers, requestedProductId: product?._id };
}

export const backfillApplicationProductIds = migrations.define({
	table: "companyApplications",
	migrateOne: async (ctx, row) => ({ productId: (await productOf(ctx, row))?._id }),
});

export const backfillPendingApplicationProductIds = migrations.define({
	table: "pendingCompanyApplications",
	migrateOne: async (ctx, { form }) => ({
		form: { ...form, productId: (await productOf(ctx, form))?._id },
	}),
});

export const backfillOfferProductIds = migrations.define({
	table: "companyApplicationOffers",
	migrateOne: async (ctx, row) => ({ productId: (await productOf(ctx, row))?._id }),
});

export const backfillPlanningProductIds = migrations.define({
	table: "eventPlanning",
	migrateOne: async (ctx, row) => ({
		productId: row.eventType && (await productOf(ctx, { ...row, eventType: row.eventType }))?._id,
		answers: await withRequestedProduct(ctx, row.answers),
	}),
});

export const backfillPlanningSubmissionProductIds = migrations.define({
	table: "eventPlanningSubmissions",
	migrateOne: async (ctx, row) => ({
		answers: await withRequestedProduct(ctx, row.answers),
		draft: await withRequestedProduct(ctx, row.draft),
	}),
});

export async function backfillProductIds(ctx: MutationCtx) {
	await migrations.runSerially(ctx, [
		internal.products.migrations.backfillApplicationProductIds,
		internal.products.migrations.backfillPendingApplicationProductIds,
		internal.products.migrations.backfillOfferProductIds,
		internal.products.migrations.backfillPlanningProductIds,
		internal.products.migrations.backfillPlanningSubmissionProductIds,
	]);
}

export async function seedAndBackfillProducts(ctx: MutationCtx) {
	const seeded = await seedProductsIfEmpty(ctx);
	if (seeded.length > 0) await migrations.runSerially(ctx, BACKFILLS);
	return seeded;
}
