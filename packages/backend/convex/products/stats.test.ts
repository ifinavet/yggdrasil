import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../test/fixtures";
import { api } from "../_generated/api";

async function fixture() {
	const { t, companyId } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const editor = await insertUser(t, "editor@example.test");
	await grantRole(t, editor._id, "editor");
	return { t, companyId, admin: asUser(t, admin), editor: asUser(t, editor) };
}

const priced = {
	name: "Ordinær bedriftspresentasjon",
	shortDescription: "",
	longDescription: "",
	category: "event" as const,
	unitPriceOre: 3_000_000,
	vatRate: 25,
	sortOrder: 0,
	active: true,
};

const jobListingProduct = {
	name: "Stillingsannonse",
	shortDescription: "",
	longDescription: "",
	category: "job_listing" as const,
	vatRate: 25,
	sortOrder: 0,
	active: true,
	volumeTiers: [
		{ quantity: 1, totalPriceOre: 300_000 },
		{ quantity: 2, totalPriceOre: 550_000 },
	],
};

describe("products stats sales", () => {
	it("refuses callers below admin", async () => {
		const { editor } = await fixture();
		await expect(refusalMessageFrom(editor.query(api.products.stats.sales, {}))).resolves.toContain(
			"Unauthorized",
		);
	});

	it("includes event sales with the snapshotted price", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", priced));
		const eventStart = new Date("2026-10-01T10:00:00Z").getTime();
		await insertEvent(t, companyId, {
			eventStart,
			product: { productId, name: priced.name, unitPriceOre: priced.unitPriceOre },
		});

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([
			{
				semester: "høst",
				year: 2026,
				productId,
				productName: priced.name,
				category: "event",
				companyId,
				companyName: "Testbedrift",
				excluded: false,
				quantity: 1,
				revenueOre: priced.unitPriceOre,
				guessed: false,
				soldAt: eventStart,
			},
		]);
	});

	it("marks an event sale with a guessed product", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", priced));
		await insertEvent(t, companyId, {
			product: { productId, name: priced.name, unitPriceOre: priced.unitPriceOre },
			productGuessed: true,
		});

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([expect.objectContaining({ guessed: true })]);
	});

	it("falls back to the other category when the sold product is gone", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", priced));
		await insertEvent(t, companyId, {
			product: { productId, name: priced.name, unitPriceOre: priced.unitPriceOre },
		});
		await t.run((ctx) => ctx.db.delete(productId));

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([expect.objectContaining({ category: "other" })]);
	});

	it("reports zero revenue for an unpriced event snapshot", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) =>
			ctx.db.insert("products", { ...priced, unitPriceOre: undefined }),
		);
		await insertEvent(t, companyId, {
			product: { productId, name: priced.name },
		});

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([expect.objectContaining({ revenueOre: 0 })]);
	});

	it("excludes events without a product", async () => {
		const { t, companyId, admin } = await fixture();
		await insertEvent(t, companyId);

		expect(await admin.query(api.products.stats.sales, {})).toEqual([]);
	});

	it("counts a presentation by the main sponsor as zero revenue", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", priced));
		await insertEvent(t, companyId, {
			product: { productId, name: priced.name, unitPriceOre: priced.unitPriceOre },
		});
		await t.run((ctx) => ctx.db.patch(companyId, { mainSponsor: true }));

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([expect.objectContaining({ revenueOre: 0 })]);
	});

	it("marks sales from a company excluded from revenue", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", priced));
		await insertEvent(t, companyId, {
			product: { productId, name: priced.name, unitPriceOre: priced.unitPriceOre },
		});
		await t.run((ctx) => ctx.db.patch(companyId, { excludedFromRevenue: true }));

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([
			expect.objectContaining({ excluded: true, revenueOre: priced.unitPriceOre }),
		]);
	});

	it("labels an event with an unknown company", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", priced));
		await insertEvent(t, companyId, {
			product: { productId, name: priced.name, unitPriceOre: priced.unitPriceOre },
		});
		await t.run((ctx) => ctx.db.delete(companyId));

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([expect.objectContaining({ companyName: "Ukjent bedrift" })]);
	});

	it("groups job listing sales per company and semester with tiered pricing", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", jobListingProduct));
		const deadline = new Date("2027-03-01T00:00:00Z").getTime();
		await t.run((ctx) =>
			ctx.db.insert("jobListings", {
				title: "Sommerjobb 1",
				type: "internship",
				teaser: "",
				description: "",
				applicationUrl: "",
				published: true,
				company: companyId,
				deadline,
				product: { productId, name: jobListingProduct.name },
			}),
		);
		await t.run((ctx) =>
			ctx.db.insert("jobListings", {
				title: "Sommerjobb 2",
				type: "internship",
				teaser: "",
				description: "",
				applicationUrl: "",
				published: true,
				company: companyId,
				deadline: deadline + 1000,
				product: { productId, name: jobListingProduct.name },
				productGuessed: true,
			}),
		);

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([
			expect.objectContaining({
				productId,
				companyId,
				category: "job_listing",
				quantity: 2,
				revenueOre: 550_000,
				guessed: true,
				soldAt: deadline + 1000,
			}),
		]);
	});

	it("excludes job listings without a product", async () => {
		const { t, companyId, admin } = await fixture();
		await t.run((ctx) =>
			ctx.db.insert("jobListings", {
				title: "Uten produkt",
				type: "internship",
				teaser: "",
				description: "",
				applicationUrl: "",
				published: true,
				company: companyId,
				deadline: Date.now(),
			}),
		);

		expect(await admin.query(api.products.stats.sales, {})).toEqual([]);
	});

	it("prices a job listing product without volume tiers as zero", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) =>
			ctx.db.insert("products", { ...jobListingProduct, volumeTiers: undefined }),
		);
		await t.run((ctx) =>
			ctx.db.insert("jobListings", {
				title: "Sommerjobb",
				type: "internship",
				teaser: "",
				description: "",
				applicationUrl: "",
				published: true,
				company: companyId,
				deadline: Date.now(),
				product: { productId, name: jobListingProduct.name },
			}),
		);

		const sales = await admin.query(api.products.stats.sales, {});
		expect(sales).toEqual([expect.objectContaining({ revenueOre: 0 })]);
	});
});
