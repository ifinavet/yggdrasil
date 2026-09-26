import { STUDENT_CAP } from "@workspace/shared/semester/application";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { migrations } from "../migrations";
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

export const backfillAll = migrations.runner(BACKFILLS);

export async function seedAndBackfillProducts(ctx: MutationCtx) {
	const seeded = await seedProductsIfEmpty(ctx);
	if (seeded.length > 0) await migrations.runSerially(ctx, BACKFILLS);
	return seeded;
}

export const setup = internalMutation({
	handler: seedAndBackfillProducts,
});
