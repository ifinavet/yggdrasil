import { describe, expect, it, vi } from "vitest";
import { insertEvent, setup, type TestBackend } from "../../test/fixtures";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { guessEventProductName } from "./migrations";
import { SEED_PRODUCTS } from "./seed";

type Backfill =
	| typeof internal.products.migrations.backfillEventProducts
	| typeof internal.products.migrations.backfillJobListingProducts;

function seedProducts(t: TestBackend) {
	return t.run(async (ctx) => {
		for (const [sortOrder, seed] of SEED_PRODUCTS.entries()) {
			await ctx.db.insert("products", { ...seed, vatRate: 25, sortOrder, active: true });
		}
	});
}

function runOneBatch(t: TestBackend, backfill: Backfill) {
	return t.mutation(backfill, { oneBatchOnly: true, cursor: null, dryRun: false });
}

async function manualSnapshot(t: TestBackend, category: Doc<"products">["category"]) {
	const productId = await t.run((ctx) =>
		ctx.db.insert("products", {
			name: "Manuelt satt",
			shortDescription: "",
			longDescription: "",
			category,
			vatRate: 25,
			sortOrder: 99,
			active: true,
		}),
	);
	return { productId, name: "Manuelt satt", unitPriceOre: 1 };
}

describe("guessEventProductName", () => {
	it("guesses external events", () => {
		expect(guessEventProductName({ externalEvent: true, participationLimit: 10 })).toBe(
			"Eksterne arrangementer",
		);
	});

	it("guesses large events above the standard cap", () => {
		expect(guessEventProductName({ externalEvent: false, participationLimit: 41 })).toBe(
			"Stor bedriftspresentasjon",
		);
	});

	it("guesses regular events at or below the standard cap", () => {
		expect(guessEventProductName({ externalEvent: false, participationLimit: 40 })).toBe(
			"Ordinær bedriftspresentasjon",
		);
	});
});

describe("backfillEventProducts", () => {
	const migrate = (t: TestBackend) =>
		runOneBatch(t, internal.products.migrations.backfillEventProducts);

	it("guesses a product and marks it as guessed for events missing one", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });

		await migrate(t);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event).toMatchObject({
			product: { name: "Ordinær bedriftspresentasjon" },
			productGuessed: true,
		});
	});

	it("skips events that already have a product", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const existing = await manualSnapshot(t, "event");
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 10,
			product: existing,
			productGuessed: false,
		});

		await migrate(t);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.product).toEqual(existing);
		expect(event?.productGuessed).toBe(false);
	});

	it("leaves the event untouched when the guessed product name has no match", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });

		await migrate(t);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.product).toBeUndefined();
		expect(event?.productGuessed).toBeUndefined();
	});
});

describe("backfillJobListingProducts", () => {
	const migrate = (t: TestBackend) =>
		runOneBatch(t, internal.products.migrations.backfillJobListingProducts);

	async function insertListing(
		t: TestBackend,
		companyId: Id<"companies">,
		overrides: Record<string, unknown> = {},
	) {
		return t.run((ctx) =>
			ctx.db.insert("jobListings", {
				title: "Sommerjobb",
				type: "internship",
				teaser: "",
				description: "",
				applicationUrl: "",
				published: true,
				company: companyId,
				deadline: Date.now(),
				...overrides,
			}),
		);
	}

	it("guesses the job listing product for listings missing one", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const listingId = await insertListing(t, companyId);

		await migrate(t);

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing).toMatchObject({ product: { name: "Stillingsannonse" }, productGuessed: true });
	});

	it("skips listings that already have a product", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const existing = await manualSnapshot(t, "job_listing");
		const listingId = await insertListing(t, companyId, {
			product: existing,
			productGuessed: false,
		});

		await migrate(t);

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.product).toEqual(existing);
		expect(listing?.productGuessed).toBe(false);
	});

	it("leaves the listing untouched when no job listing product exists", async () => {
		const { t, companyId } = await setup();
		const listingId = await insertListing(t, companyId);

		await migrate(t);

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.product).toBeUndefined();
	});
});

describe("setup", () => {
	it("seeds an empty table once and backfills events", async () => {
		vi.useFakeTimers();
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });

		expect(await t.mutation(internal.products.migrations.setup, {})).toEqual(
			SEED_PRODUCTS.map((product) => product.name),
		);
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event).toMatchObject({
			product: { name: "Ordinær bedriftspresentasjon" },
			productGuessed: true,
		});
		vi.useRealTimers();
	});

	it("does not seed again after products were renamed or archived", async () => {
		const { t } = await setup();
		await t.mutation(internal.products.migrations.setup, {});
		await t.run(async (ctx) => {
			for (const product of await ctx.db.query("products").collect()) {
				await ctx.db.patch(product._id, { name: `${product.name} (gammel)`, active: false });
			}
		});

		expect(await t.mutation(internal.products.migrations.setup, {})).toEqual([]);
		const products = await t.run((ctx) => ctx.db.query("products").collect());
		expect(products).toHaveLength(SEED_PRODUCTS.length);
	});
});
