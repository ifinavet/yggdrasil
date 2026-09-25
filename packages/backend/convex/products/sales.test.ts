import { describe, expect, it } from "vitest";
import { refusalMessageFrom, setup } from "../../test/fixtures";
import type { Id } from "../_generated/dataModel";
import { activeProductIn, eventProductFields, jobListingProductFields, snapshotOf } from "./sales";

const eventProduct = {
	name: "Ordinær bedriftspresentasjon",
	shortDescription: "",
	longDescription: "",
	category: "event" as const,
	unitPriceOre: 3_000_000,
	vatRate: 25,
	sortOrder: 0,
	active: true,
};

describe("snapshotOf", () => {
	it("captures the id, name and price of a product", async () => {
		const { t } = await setup();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const product = await t.run((ctx) => ctx.db.get(productId));
		if (!product) throw new Error("Missing fixture");
		expect(snapshotOf(product)).toEqual({
			productId,
			name: eventProduct.name,
			unitPriceOre: eventProduct.unitPriceOre,
		});
	});
});

describe("eventProductFields", () => {
	it("returns nothing when no product id is given", async () => {
		const { t } = await setup();
		const fields = await t.run((ctx) => eventProductFields(ctx, undefined));
		expect(fields).toEqual({});
	});

	it("keeps the current snapshot and clears the guessed flag when the product is unchanged", async () => {
		const { t } = await setup();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const current = {
			product: { productId, name: eventProduct.name, unitPriceOre: eventProduct.unitPriceOre },
			productGuessed: true,
		};
		const fields = await t.run((ctx) => eventProductFields(ctx, productId, current));
		expect(fields).toEqual({ product: current.product, productGuessed: undefined });
	});

	it("snapshots a new active event product", async () => {
		const { t } = await setup();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const fields = await t.run((ctx) => eventProductFields(ctx, productId));
		expect(fields).toEqual({
			product: { productId, name: eventProduct.name, unitPriceOre: eventProduct.unitPriceOre },
			productGuessed: undefined,
		});
	});

	it("refuses an inactive product", async () => {
		const { t } = await setup();
		const productId = await t.run((ctx) =>
			ctx.db.insert("products", { ...eventProduct, active: false }),
		);
		await expect(
			refusalMessageFrom(t.run((ctx) => eventProductFields(ctx, productId))),
		).resolves.toBe("Velg et aktivt produkt for arrangementer.");
	});

	it("refuses a product outside the event categories", async () => {
		const { t } = await setup();
		const productId = await t.run((ctx) =>
			ctx.db.insert("products", { ...eventProduct, category: "job_listing" }),
		);
		await expect(
			refusalMessageFrom(t.run((ctx) => eventProductFields(ctx, productId))),
		).resolves.toBe("Velg et aktivt produkt for arrangementer.");
	});
});

describe("activeProductIn", () => {
	it("returns the first active product in a category", async () => {
		const { t } = await setup();
		await t.run((ctx) => ctx.db.insert("products", { ...eventProduct, active: false }));
		const activeId = await t.run((ctx) =>
			ctx.db.insert("products", { ...eventProduct, name: "Aktivt", sortOrder: 1 }),
		);
		const found = await t.run((ctx) => activeProductIn(ctx, "event"));
		expect(found?._id).toBe(activeId);
	});

	it("returns null without an active product in the category", async () => {
		const { t } = await setup();
		await t.run((ctx) => ctx.db.insert("products", { ...eventProduct, active: false }));
		const found = await t.run((ctx) => activeProductIn(ctx, "event"));
		expect(found).toBeNull();
	});
});

describe("jobListingProductFields", () => {
	it("snapshots the active job listing product", async () => {
		const { t } = await setup();
		const productId: Id<"products"> = await t.run((ctx) =>
			ctx.db.insert("products", { ...eventProduct, category: "job_listing", name: "Annonse" }),
		);
		const fields = await t.run((ctx) => jobListingProductFields(ctx));
		expect(fields).toEqual({
			product: { productId, name: "Annonse", unitPriceOre: eventProduct.unitPriceOre },
		});
	});

	it("returns nothing without an active job listing product", async () => {
		const { t } = await setup();
		const fields = await t.run((ctx) => jobListingProductFields(ctx));
		expect(fields).toEqual({});
	});
});
