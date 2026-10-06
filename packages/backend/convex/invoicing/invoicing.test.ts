import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertSemester,
	insertUser,
	setup,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { cancelInvoice, scheduleInvoice } from "./schedule";

async function fixture(serviceAt = Date.now() - 86_400_000) {
	const { t, companyId } = await setup();
	const adminUser = await insertUser(t, "cfo@example.com");
	await grantRole(t, adminUser._id, "admin");
	const admin = asUser(t, adminUser);
	const productId = await t.run((ctx) =>
		ctx.db.insert("products", {
			name: "Stillingsannonse",
			shortDescription: "",
			longDescription: "",
			category: "job_listing",
			vatRate: 25,
			sortOrder: 1,
			active: true,
		}),
	);
	const orderId = await t.run((ctx) =>
		ctx.db.insert("jobListingOrders", {
			reference: "2026-42",
			submissionId: "submission-42",
			status: "published",
			companyId,
			productId,
			productName: "Stillingsannonse",
			startup: false,
			quantity: 2,
			priceOre: 550_000,
			contact: { name: "Kari", email: "kari@example.com" },
			billing: { address: "Fakturaveien 1", email: "faktura@example.com", reference: "PO-42" },
			ehfInvoice: true,
			note: "Faktura merkes med prosjekt 7781",
		}),
	);
	await t.run((ctx) => scheduleInvoice(ctx, { kind: "jobListingOrder", orderId }, serviceAt));
	const invoice = await t.run((ctx) => ctx.db.query("invoices").first());
	if (!invoice) throw new Error("Expected invoice");
	return { t, admin, companyId, productId, orderId, invoice, serviceAt };
}

async function list(
	admin: Awaited<ReturnType<typeof fixture>>["admin"],
	status: "pending" | "sent" | "cancelled",
) {
	return admin.query(api.invoicing.admin.list, {
		status,
		paginationOpts: { cursor: null, numItems: 30 },
	});
}

describe("manual invoice queue", () => {
	it("shows copyable billing fields and moves a delivered item to sent with a frozen snapshot", async () => {
		const f = await fixture();
		const pending = await list(f.admin, "pending");
		expect(pending.page).toMatchObject([{ companyName: "Testbedrift", amountOre: 550_000 }]);
		const before = await f.admin.query(api.invoicing.admin.get, { invoiceId: f.invoice._id });
		expect(before?.preview).toMatchObject({
			kind: "ready",
			details: {
				customer: {
					email: "faktura@example.com",
					billingDetails: "Fakturaveien 1",
					ehfInvoice: true,
				},
				yourReference: "PO-42",
				comment: "Faktura merkes med prosjekt 7781",
				line: { unitPrice: 550_000, vatRate: 25 },
			},
		});

		await f.admin.mutation(api.invoicing.admin.markSent, { invoiceId: f.invoice._id });
		await f.t.run((ctx) =>
			ctx.db.patch(f.orderId, { priceOre: 750_000, note: "Endret etter sending" }),
		);
		expect(
			(await f.admin.query(api.invoicing.admin.get, { invoiceId: f.invoice._id }))?.preview,
		).toMatchObject({ details: { comment: "Faktura merkes med prosjekt 7781" } });
		expect((await list(f.admin, "pending")).page).toHaveLength(0);
		expect((await list(f.admin, "sent")).page).toMatchObject([{ amountOre: 550_000 }]);
		expect(
			(await f.admin.query(api.invoicing.admin.get, { invoiceId: f.invoice._id }))?.invoice.sentAt,
		).toBeTypeOf("number");

		await f.admin.mutation(api.invoicing.admin.markUnsent, { invoiceId: f.invoice._id });
		expect((await list(f.admin, "pending")).page).toMatchObject([{ amountOre: 750_000 }]);
	});

	it("does not allow marking a future event or an incomplete invoice as sent", async () => {
		const f = await fixture(Date.now() + 86_400_000);
		await expect(
			f.admin.mutation(api.invoicing.admin.markSent, { invoiceId: f.invoice._id }),
		).rejects.toThrow();
		await f.t.run((ctx) => ctx.db.patch(f.orderId, { status: "rejected" }));
		await expect(
			f.admin.mutation(api.invoicing.admin.markSent, { invoiceId: f.invoice._id }),
		).rejects.toThrow();
	});

	it("keeps one record per sale, updates its date, and never reopens a sent record automatically", async () => {
		const f = await fixture();
		await f.t.run((ctx) =>
			scheduleInvoice(ctx, { kind: "jobListingOrder", orderId: f.orderId }, f.serviceAt + 1_000),
		);
		expect(await f.t.run((ctx) => ctx.db.query("invoices").collect())).toHaveLength(1);
		await f.admin.mutation(api.invoicing.admin.markSent, { invoiceId: f.invoice._id });
		await f.t.run((ctx) =>
			scheduleInvoice(ctx, { kind: "jobListingOrder", orderId: f.orderId }, f.serviceAt + 2_000),
		);
		expect((await f.t.run((ctx) => ctx.db.get(f.invoice._id)))?.status).toBe("sent");
	});

	it("includes completed company events and restricts changes to admins", async () => {
		const f = await fixture();
		const eventProductId = await f.t.run((ctx) =>
			ctx.db.insert("products", {
				name: "Bedriftspresentasjon",
				shortDescription: "",
				longDescription: "",
				category: "event",
				unitPriceOre: 3_000_000,
				vatRate: 25,
				eventType: "standard_presentation",
				sortOrder: 2,
				active: true,
			}),
		);
		const eventId = await insertEvent(f.t, f.companyId, {
			eventStart: Date.now() - 86_400_000,
			product: { productId: eventProductId, name: "Bedriftspresentasjon", unitPriceOre: 3_000_000 },
		});
		const semesterId = await insertSemester(f.t);
		const applicationId = await insertApplication(f.t, semesterId, {
			status: "confirmed",
			eventId,
		});
		await f.t.run((ctx) =>
			scheduleInvoice(ctx, { kind: "companyApplication", applicationId }, Date.now() - 86_400_000),
		);
		const eventInvoiceId = (await f.t.run((ctx) => ctx.db.query("invoices").order("desc").first()))
			?._id as Id<"invoices">;
		const detail = await f.admin.query(api.invoicing.admin.get, { invoiceId: eventInvoiceId });
		expect(detail?.preview).toMatchObject({
			kind: "ready",
			details: {
				line: { unitPrice: 3_000_000 },
				customer: { billingDetails: "Referanse: PO-2027-014" },
			},
		});

		const editor = await insertUser(f.t, "editor@example.com");
		await grantRole(f.t, editor._id, "editor");
		await expect(
			asUser(f.t, editor).mutation(api.invoicing.admin.markSent, { invoiceId: eventInvoiceId }),
		).rejects.toThrow();
		await f.admin.mutation(api.invoicing.admin.cancel, { invoiceId: eventInvoiceId });
		expect((await list(f.admin, "cancelled")).page).toHaveLength(1);
	});

	it("uses the company billing fallback and keeps invalid sources visible for review", async () => {
		const f = await fixture();
		await f.t.run((ctx) =>
			ctx.db.patch(f.companyId, {
				registryName: "TESTBEDRIFT AS",
				billing: {
					address: "Selskapsgata 2",
					email: "okonomi@example.com",
					reference: "PO-COMPANY",
				},
			}),
		);
		await f.t.run((ctx) => ctx.db.patch(f.orderId, { billing: undefined }));
		const fallback = await f.admin.query(api.invoicing.admin.get, { invoiceId: f.invoice._id });
		expect(fallback?.preview).toMatchObject({
			kind: "ready",
			details: {
				customer: {
					name: "TESTBEDRIFT AS",
					email: "okonomi@example.com",
					billingDetails: "Selskapsgata 2",
				},
				yourReference: "PO-COMPANY",
			},
		});

		await f.t.run((ctx) => ctx.db.delete(f.productId));
		expect(
			(await f.admin.query(api.invoicing.admin.get, { invoiceId: f.invoice._id }))?.preview,
		).toMatchObject({ kind: "ready", details: { line: { vatRate: 25 } } });
		await f.t.run((ctx) => ctx.db.delete(f.companyId));
		expect(
			(await f.admin.query(api.invoicing.admin.get, { invoiceId: f.invoice._id }))?.preview,
		).toMatchObject({ kind: "fail" });
		expect((await list(f.admin, "pending")).page[0]?.issue).toContain("Fant ikke bedriften");
		await f.t.run((ctx) => ctx.db.delete(f.orderId));
		expect((await list(f.admin, "pending")).page[0]).toMatchObject({
			companyName: "",
			issue: "Grunnlaget er ikke lenger aktivt.",
		});
		await expect(
			f.admin.mutation(api.invoicing.admin.markSent, { invoiceId: f.invoice._id }),
		).rejects.toThrow();
	});

	it("resolves event prices from products and reports withdrawn or missing sources", async () => {
		const f = await fixture();
		const productId = await f.t.run((ctx) =>
			ctx.db.insert("products", {
				name: "Ordinær bedriftspresentasjon",
				shortDescription: "",
				longDescription: "",
				category: "event",
				unitPriceOre: 3_000_000,
				vatRate: 25,
				eventType: "standard_presentation",
				sortOrder: 2,
				active: true,
			}),
		);
		const eventId = await insertEvent(f.t, f.companyId, { eventStart: Date.now() - 86_400_000 });
		const semesterId = await insertSemester(f.t);
		const applicationId = await insertApplication(f.t, semesterId, {
			status: "confirmed",
			eventId,
		});
		await f.t.run((ctx) =>
			scheduleInvoice(ctx, { kind: "companyApplication", applicationId }, Date.now() - 86_400_000),
		);
		const invoiceId = (await f.t.run((ctx) => ctx.db.query("invoices").order("desc").first()))
			?._id as Id<"invoices">;
		expect((await f.admin.query(api.invoicing.admin.get, { invoiceId }))?.preview).toMatchObject({
			kind: "ready",
			details: { line: { description: "Ordinær bedriftspresentasjon", unitPrice: 3_000_000 } },
		});

		await f.t.run((ctx) => ctx.db.patch(productId, { active: false }));
		expect((await f.admin.query(api.invoicing.admin.get, { invoiceId }))?.preview).toMatchObject({
			kind: "fail",
		});
		await f.t.run((ctx) =>
			ctx.db.patch(eventId, { product: { productId, name: "Ordinær bedriftspresentasjon" } }),
		);
		await f.t.run((ctx) => ctx.db.patch(productId, { unitPriceOre: undefined }));
		expect((await f.admin.query(api.invoicing.admin.get, { invoiceId }))?.preview).toMatchObject({
			kind: "fail",
		});
		await f.t.run((ctx) => ctx.db.patch(applicationId, { status: "withdrawn" }));
		expect((await f.admin.query(api.invoicing.admin.get, { invoiceId }))?.preview).toMatchObject({
			kind: "cancel",
		});
		await f.t.run((ctx) => ctx.db.delete(applicationId));
		expect((await f.admin.query(api.invoicing.admin.get, { invoiceId }))?.invoice.companyName).toBe(
			"",
		);
	});

	it("guards status changes and lets a cancelled source be rescheduled", async () => {
		const f = await fixture();
		await expect(
			f.admin.mutation(api.invoicing.admin.markUnsent, { invoiceId: f.invoice._id }),
		).rejects.toThrow();
		await f.t.run((ctx) => cancelInvoice(ctx, { kind: "jobListingOrder", orderId: f.orderId }));
		expect((await f.t.run((ctx) => ctx.db.get(f.invoice._id)))?.status).toBe("cancelled");
		await f.t.run((ctx) => cancelInvoice(ctx, { kind: "jobListingOrder", orderId: f.orderId }));
		await expect(
			f.admin.mutation(api.invoicing.admin.cancel, { invoiceId: f.invoice._id }),
		).rejects.toThrow();
		await f.t.run((ctx) =>
			scheduleInvoice(ctx, { kind: "jobListingOrder", orderId: f.orderId }, f.serviceAt),
		);
		expect((await f.t.run((ctx) => ctx.db.get(f.invoice._id)))?.status).toBe("pending");
		await f.admin.mutation(api.invoicing.admin.markSent, { invoiceId: f.invoice._id });
		await expect(
			f.admin.mutation(api.invoicing.admin.markSent, { invoiceId: f.invoice._id }),
		).rejects.toThrow();
		await expect(
			f.admin.mutation(api.invoicing.admin.cancel, { invoiceId: f.invoice._id }),
		).rejects.toThrow();
		await f.t.run((ctx) => cancelInvoice(ctx, { kind: "jobListingOrder", orderId: f.orderId }));
		const sent = await list(f.admin, "sent");
		expect(sent.page).toMatchObject([{ companyName: "Testbedrift" }]);
		await f.t.run((ctx) => ctx.db.delete(f.orderId));
		expect((await list(f.admin, "sent")).page).toMatchObject([{ companyName: "Testbedrift" }]);
		await f.t.run((ctx) => ctx.db.delete(f.invoice._id));
		expect(await f.admin.query(api.invoicing.admin.get, { invoiceId: f.invoice._id })).toBeNull();
	});
});
