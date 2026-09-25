import { describe, expect, it } from "vitest";
import { insertEvent, setup } from "../../test/fixtures";
import { internal } from "../_generated/api";
import { guessEventProductName } from "./migrations";
import { SEED_PRODUCTS } from "./seed";

function seedProducts(t: Awaited<ReturnType<typeof setup>>["t"]) {
	return t.run(async (ctx) => {
		for (const [sortOrder, seed] of SEED_PRODUCTS.entries()) {
			await ctx.db.insert("products", { ...seed, vatRate: 25, sortOrder, active: true });
		}
	});
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
	async function migrate(t: Awaited<ReturnType<typeof setup>>["t"]) {
		return t.mutation(internal.products.migrations.backfillEventProducts, {
			oneBatchOnly: true,
			cursor: null,
			dryRun: false,
		});
	}

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
		const otherProductId = await t.run((ctx) =>
			ctx.db.insert("products", {
				name: "Manuelt satt",
				shortDescription: "",
				longDescription: "",
				category: "event" as const,
				vatRate: 25,
				sortOrder: 99,
				active: true,
			}),
		);
		const existing = { productId: otherProductId, name: "Manuelt satt", unitPriceOre: 1 };
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
	async function migrate(t: Awaited<ReturnType<typeof setup>>["t"]) {
		return t.mutation(internal.products.migrations.backfillJobListingProducts, {
			oneBatchOnly: true,
			cursor: null,
			dryRun: false,
		});
	}

	async function insertListing(
		t: Awaited<ReturnType<typeof setup>>["t"],
		companyId: Awaited<ReturnType<typeof setup>>["companyId"],
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
		const otherProductId = await t.run((ctx) =>
			ctx.db.insert("products", {
				name: "Manuelt satt",
				shortDescription: "",
				longDescription: "",
				category: "job_listing" as const,
				vatRate: 25,
				sortOrder: 99,
				active: true,
			}),
		);
		const existing = { productId: otherProductId, name: "Manuelt satt", unitPriceOre: 1 };
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
