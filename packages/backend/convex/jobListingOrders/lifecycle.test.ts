import { productInputSchema } from "@workspace/shared/products";
import { osloToday } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import { setupAdminAndEditor } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

async function fixture(deadline = osloToday(Date.now() + 86400000 * 30)) {
	const f = await setupAdminAndEditor();
	const productId = await f.admin.mutation(api.products.mutations.create, {
		name: "Review product",
		category: "job_listing",
		shortDescription: "",
		longDescription: "",
		vatRate: 25,
		volumeTiers: [{ quantity: 1, totalPriceOre: 300000 }],
	});
	const form = {
		company: { kind: "existing" as const, companyId: f.companyId },
		productId,
		startup: false,
		listings: [
			{
				title: "Utvikler",
				teaser: "Bli med",
				description: "<p>En jobb</p>",
				applicationUrl: "https://example.com",
				deadline,
				type: "Fulltid",
			},
		],
		contact: { name: "Test", email: "review@example.com" },
		billing: { address: "Testveien 1", email: "billing@example.com", reference: "Test" },
		confirmAmount: true,
	};
	return { ...f, productId, form };
}

describe("order lifecycle regressions", () => {
	it("rejects unpriced legacy products at the public boundary", async () => {
		const f = await fixture();
		await f.t.run((ctx) =>
			ctx.db.patch(f.productId, { volumeTiers: undefined, unitPriceOre: 300000 }),
		);
		expect(
			productInputSchema.safeParse({
				name: "Unpriced",
				category: "job_listing",
				shortDescription: "",
				longDescription: "",
				vatRate: 25,
				unitPriceOre: 300000,
			}).success,
		).toBe(false);
		await expect(
			f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
				form: f.form,
				submissionId: "unpriced",
				token: "unpriced",
			}),
		).rejects.toThrow();
		expect(await f.t.query(api.jobListingOrders.form.product, {})).toBeNull();
	});

	it("accepts an explicitly free package", async () => {
		const f = await fixture();
		await f.admin.mutation(api.products.mutations.update, {
			id: f.productId,
			name: "Free",
			category: "job_listing",
			shortDescription: "",
			longDescription: "",
			vatRate: 25,
			volumeTiers: [{ quantity: 1, totalPriceOre: 0 }],
		});
		const result = await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
			form: f.form,
			submissionId: "free",
			token: "free",
		});
		expect((await f.t.run((ctx) => ctx.db.get(result.orderId)))?.priceOre).toBe(0);
	});

	it("rejecting a billing update restores approved billing in the invoice preview", async () => {
		const f = await fixture(osloToday(Date.now() + 86400000 * 30));
		const oldBilling = { address: "Old address", email: "old@example.com", reference: "Old" };
		await f.t.run((ctx) => ctx.db.patch(f.companyId, { billing: oldBilling }));
		const inserted = await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
			form: f.form,
			submissionId: "review-billing",
			token: "review-billing-token",
		});
		await f.t.mutation(api.jobListingOrders.orders.confirm, { token: "review-billing-token" });
		const request = await f.t.run((ctx) => ctx.db.query("companyUpdateRequests").first());
		if (!request) throw new Error("Missing request");
		await f.admin.mutation(api.jobListingOrders.admin.decideUpdate, {
			requestId: request._id,
			approve: false,
		});
		await f.admin.mutation(api.jobListingOrders.admin.approve, { orderId: inserted.orderId });
		const order = await f.admin.query(api.jobListingOrders.admin.getOrder, {
			orderId: inserted.orderId,
		});
		expect(order?.billing).toEqual(oldBilling);
		expect(order?.company?.billing).toEqual(oldBilling);
		const invoice = await f.t.run((ctx) => ctx.db.query("invoices").first());
		if (!invoice) throw new Error("Missing invoice");
		const detail = await f.admin.query(api.invoicing.admin.get, { invoiceId: invoice._id });
		expect(detail?.preview).toMatchObject({
			kind: "ready",
			details: { customer: { email: oldBilling.email } },
		});
	});

	it("changing product VAT after ordering preserves the pending invoice tax rate", async () => {
		const f = await fixture(osloToday(Date.now() + 86400000 * 30));
		const inserted = await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
			form: f.form,
			submissionId: "review-vat",
			token: "review-vat-token",
		});
		await f.t.mutation(api.jobListingOrders.orders.confirm, { token: "review-vat-token" });
		await f.admin.mutation(api.jobListingOrders.admin.approve, { orderId: inserted.orderId });
		const invoice = await f.t.run((ctx) => ctx.db.query("invoices").first());
		if (!invoice) throw new Error("Missing invoice");
		const before = await f.admin.query(api.invoicing.admin.get, { invoiceId: invoice._id });
		expect(before?.preview).toMatchObject({ kind: "ready", details: { line: { vatRate: 25 } } });
		await f.t.run((ctx) => ctx.db.patch(f.productId, { vatRate: 0 }));
		const after = await f.admin.query(api.invoicing.admin.get, { invoiceId: invoice._id });
		expect(after?.preview).toMatchObject({ kind: "ready", details: { line: { vatRate: 25 } } });
	});

	it("purging an abandoned submission preserves a logo used by an approved retry", async () => {
		const f = await fixture(osloToday(Date.now() + 86400000 * 30));
		const logo = await f.t.run(async (ctx) => {
			const id = await ctx.storage.store(new Blob(["logo"], { type: "image/png" }));
			// convex-test's storage metadata does not preserve the Blob type.
			// biome-ignore lint/suspicious/noExplicitAny: convex-test storage metadata omits contentType.
			await (ctx.db as any).patch(id, { contentType: "image/png" });
			return id;
		});
		const form = {
			...f.form,
			company: {
				kind: "new" as const,
				orgNumber: "924773189",
				displayName: "Review AS",
				description: "<p>Company</p>",
				logo,
			},
		};
		const first = await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
			form,
			submissionId: "review-retry-one",
			token: "review-retry-one",
			registryName: "Review AS",
		});
		const second = await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
			form,
			submissionId: "review-retry-two",
			token: "review-retry-two",
			registryName: "Review AS",
		});
		await f.t.mutation(api.jobListingOrders.orders.confirm, { token: "review-retry-two" });
		await f.admin.mutation(api.jobListingOrders.admin.approve, { orderId: second.orderId });
		expect(await f.t.run((ctx) => ctx.storage.getUrl(logo))).not.toBeNull();
		await f.t.run(async (ctx) => {
			const confirmations = await ctx.db
				.query("jobListingOrderConfirmations")
				.withIndex("by_orderId", (q) => q.eq("orderId", first.orderId))
				.collect();
			for (const confirmation of confirmations)
				await ctx.db.patch(confirmation._id, { expiresAt: 0 });
		});
		await f.t.mutation(internal.jobListingOrders.orders.purgeUnconfirmed, {
			orderId: first.orderId,
		});
		expect(await f.t.run((ctx) => ctx.storage.getUrl(logo))).not.toBeNull();
		expect(await f.t.query(api.jobListings.queries.getAllPublishedAndActive, {})).toHaveLength(1);
	});
});

it("retains a company logo when rejecting an order that reuses it", async () => {
	const f = await fixture();
	const logo = await f.t.run(async (ctx) => {
		const company = await ctx.db.get(f.companyId);
		if (!company) throw new Error("Missing company");
		const row = await ctx.db.get(company.logo);
		if (!row) throw new Error("Missing logo");
		// biome-ignore lint/suspicious/noExplicitAny: convex-test storage metadata omits contentType.
		await (ctx.db as any).patch(row.image, { contentType: "image/png" });
		return row.image;
	});
	await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
		form: { ...f.form, companyChanges: { logo } },
		submissionId: "reuse",
		token: "reuse",
	});
	await f.t.mutation(api.jobListingOrders.orders.confirm, { token: "reuse" });
	const request = await f.t.run((ctx) => ctx.db.query("companyUpdateRequests").first());
	if (!request) throw new Error("Missing request");
	if (!request) throw new Error("Missing request");
	await f.admin.mutation(api.jobListingOrders.admin.decideUpdate, {
		requestId: request._id,
		approve: false,
	});
	expect(await f.t.run((ctx) => ctx.storage.getUrl(logo))).not.toBeNull();
});

it("deletes an expired order's upload only after its last order reference is gone", async () => {
	const f = await fixture();
	const logo = await f.t.run(async (ctx) => {
		const id = await ctx.storage.store(new Blob(["logo"]));
		// biome-ignore lint/suspicious/noExplicitAny: convex-test storage metadata omits contentType.
		await (ctx.db as any).patch(id, { contentType: "image/png" });
		return id;
	});
	const form = { ...f.form, companyChanges: { logo } };
	const first = await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
		form,
		submissionId: "first",
		token: "first",
	});
	const second = await f.t.mutation(internal.jobListingOrders.orders.insertOrder, {
		form,
		submissionId: "second",
		token: "second",
	});
	await f.t.run(async (ctx) => {
		for (const row of await ctx.db.query("jobListingOrderConfirmations").collect())
			await ctx.db.patch(row._id, { expiresAt: 0 });
	});
	await f.t.mutation(internal.jobListingOrders.orders.purgeUnconfirmed, { orderId: first.orderId });
	expect(await f.t.run((ctx) => ctx.storage.getUrl(logo))).not.toBeNull();
	await f.t.mutation(internal.jobListingOrders.orders.purgeUnconfirmed, {
		orderId: second.orderId,
	});
	expect(await f.t.run((ctx) => ctx.storage.getUrl(logo))).toBeNull();
});
