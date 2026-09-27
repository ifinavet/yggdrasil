import type { EmailId } from "@convex-dev/resend";
import { invoiceDueAt } from "@workspace/shared/time";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	HOUR_IN_MS,
	insertApplication,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { orderResend } from "../jobListingOrders/emails";

const BASE_URL = "https://fiken.test/api/v2";
const NOW = Date.parse("2027-01-10T10:00:00Z");
const EVENT_START = Date.parse("2027-02-09T15:15:00Z");

type FikenCall = { method: string; path: string; body: Record<string, unknown> | undefined };

type FikenReply = Response | Error;

type FikenStub = {
	contacts?: () => FikenReply;
	createContact?: () => FikenReply;
	createDraft?: () => FikenReply;
};

function created(path: string) {
	return new Response(null, { status: 201, headers: { Location: `${BASE_URL}${path}` } });
}

function stubFiken(stub: FikenStub = {}) {
	const calls: FikenCall[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init: RequestInit = {}) => {
			const url = new URL(input);
			const method = init.method ?? "GET";
			const path = url.pathname.replace("/api/v2/companies/navet", "");
			calls.push({
				method,
				path: `${path}${url.search}`,
				body: init.body ? JSON.parse(String(init.body)) : undefined,
			});
			const reply =
				method === "GET"
					? (stub.contacts?.() ?? Response.json([]))
					: path === "/contacts"
						? (stub.createContact?.() ?? created("/companies/navet/contacts/77"))
						: (stub.createDraft?.() ?? created("/companies/navet/invoices/drafts/901"));
			if (reply instanceof Error) throw reply;
			return reply;
		}),
	);
	return calls;
}

async function fixture() {
	const { t, companyId } = await setup();
	const adminUser = await insertUser(t, "admin@ifinavet.no");
	await grantRole(t, adminUser._id, "admin");
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	return { t, companyId, admin: asUser(t, adminUser), editor: asUser(t, editorUser) };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function insertListingProduct(t: TestBackend, vatRate = 25) {
	return t.run((ctx) =>
		ctx.db.insert("products", {
			name: "Stillingsannonse",
			shortDescription: "Annonse",
			longDescription: "",
			category: "job_listing",
			vatRate,
			sortOrder: 1,
			active: true,
		}),
	);
}

async function insertConfirmedOrder(
	f: Fixture,
	overrides: Partial<Doc<"jobListingOrders">> = {},
): Promise<Id<"jobListingOrders">> {
	const productId = await insertListingProduct(f.t);
	return f.t.run((ctx) =>
		ctx.db.insert("jobListingOrders", {
			reference: "NAV-1234",
			submissionId: `submission-${Math.random()}`,
			status: "confirmed",
			companyId: f.companyId,
			productId,
			productName: "Stillingsannonse",
			startup: false,
			quantity: 2,
			priceOre: 550_000,
			contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no" },
			billing: { address: "Storgata 12", email: "faktura@testbedrift.no", reference: "PO-7" },
			...overrides,
		}),
	);
}

async function approvedOrder(f: Fixture, overrides: Partial<Doc<"jobListingOrders">> = {}) {
	const orderId = await insertConfirmedOrder(f, overrides);
	await f.admin.mutation(api.jobListingOrders.admin.approve, { orderId });
	return orderId;
}

async function insertEventProduct(t: TestBackend, overrides: Partial<Doc<"products">> = {}) {
	return t.run((ctx) =>
		ctx.db.insert("products", {
			name: "Bedriftspresentasjon",
			shortDescription: "Bedpres",
			longDescription: "",
			category: "event",
			eventType: "standard_presentation",
			unitPriceOre: 3_000_000,
			vatRate: 25,
			sortOrder: 1,
			active: true,
			...overrides,
		}),
	);
}

async function confirmedApplication(f: Fixture) {
	const semesterId = await insertSemester(f.t, { defaultEventStartTime: "16:15" });
	return insertApplication(f.t, semesterId, {
		status: "confirmed",
		assignedDate: "2027-02-09",
		orgNumber: "123456789",
	});
}

async function bedpres(f: Fixture) {
	const applicationId = await confirmedApplication(f);
	const eventId = await f.editor.mutation(api.semesterPlanning.applications.mutations.createEvent, {
		applicationId,
	});
	return { applicationId, eventId };
}

async function invoices(t: TestBackend) {
	return t.run((ctx) => ctx.db.query("invoices").collect());
}

async function onlyInvoice(t: TestBackend) {
	const [invoice, ...rest] = await invoices(t);
	if (!invoice || rest.length) throw new Error("Expected exactly one invoice.");
	return invoice;
}

async function runSweep(t: TestBackend, asOf: number, maxIterations?: number) {
	vi.setSystemTime(asOf);
	const count = await t.mutation(internal.invoicing.processing.sweep, {});
	await t.finishAllScheduledFunctions(vi.runAllTimers, maxIterations);
	return count;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	vi.spyOn(orderResend, "sendEmail").mockResolvedValue("email-id" as EmailId);
	vi.stubEnv("FIKEN_API_TOKEN", "fiken-token");
	vi.stubEnv("FIKEN_COMPANY_SLUG", "navet");
	vi.stubEnv("FIKEN_API_BASE_URL", BASE_URL);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe("job listing orders", () => {
	it("schedules an invoice a month after the order is published", async () => {
		const f = await fixture();
		const orderId = await approvedOrder(f);

		expect(await onlyInvoice(f.t)).toMatchObject({
			source: { kind: "jobListingOrder", orderId },
			serviceAt: NOW,
			dueAt: invoiceDueAt(NOW),
			status: "scheduled",
			attempts: 0,
		});
	});

	it("creates the customer and a draft in Fiken once the invoice is due", async () => {
		const f = await fixture();
		await approvedOrder(f);
		const calls = stubFiken();

		expect(await runSweep(f.t, invoiceDueAt(NOW) - 1)).toBe(0);
		expect(calls).toEqual([]);

		const dueAt = invoiceDueAt(NOW);
		expect(await runSweep(f.t, dueAt)).toBe(1);

		expect(calls).toEqual([
			{
				method: "GET",
				path: "/contacts?organizationNumber=123456789&customer=true",
				body: undefined,
			},
			{
				method: "POST",
				path: "/contacts",
				body: {
					name: "Testbedrift",
					organizationNumber: "123456789",
					email: "faktura@testbedrift.no",
					customer: true,
				},
			},
			{
				method: "POST",
				path: "/invoices/drafts",
				body: {
					type: "invoice",
					customerId: 77,
					issueDate: "2027-02-10",
					daysUntilDueDate: 14,
					invoiceText: "Stillingsannonser, bestilling NAV-1234",
					yourReference: "PO-7",
					lines: [
						{
							description: "Stillingsannonse (2 stk.)",
							unitPrice: 550_000,
							quantity: 1,
							vatType: "HIGH",
						},
					],
				},
			},
		]);
		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "draft_created",
			fikenContactId: 77,
			fikenDraftId: 901,
			attempts: 1,
		});
		expect((await onlyInvoice(f.t)).draftCreatedAt).toBeGreaterThanOrEqual(dueAt);
	});

	it("reuses a customer that already exists in Fiken", async () => {
		const f = await fixture();
		await approvedOrder(f);
		const calls = stubFiken({ contacts: () => Response.json([{ contactId: 55 }]) });

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(calls.map((call) => call.path)).toEqual([
			"/contacts?organizationNumber=123456789&customer=true",
			"/invoices/drafts",
		]);
		expect(calls[1]?.body).toMatchObject({ customerId: 55 });
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "draft_created", fikenContactId: 55 });
	});

	it("bills the company's registry name and billing when the order has none", async () => {
		const f = await fixture();
		await f.t.run((ctx) =>
			ctx.db.patch(f.companyId, {
				registryName: "TESTBEDRIFT AS",
				billing: { address: "Gata 1", email: "regnskap@testbedrift.no", reference: "Kari" },
			}),
		);
		await approvedOrder(f, { billing: undefined });
		const calls = stubFiken();

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(calls[1]?.body).toMatchObject({
			name: "TESTBEDRIFT AS",
			email: "regnskap@testbedrift.no",
		});
		expect(calls[2]?.body).toMatchObject({ yourReference: "Kari" });
	});

	it("uses the default VAT rate when the product is gone", async () => {
		const f = await fixture();
		const orderId = await approvedOrder(f);
		await f.t.run(async (ctx) => {
			const order = await ctx.db.get(orderId);
			if (order) await ctx.db.delete(order.productId);
		});
		const calls = stubFiken();

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(calls[2]?.body).toMatchObject({ lines: [expect.objectContaining({ vatType: "HIGH" })] });
	});

	it("cancels the invoice when the order is no longer published", async () => {
		const f = await fixture();
		const orderId = await approvedOrder(f);
		await f.t.run((ctx) => ctx.db.patch(orderId, { status: "rejected" }));
		const calls = stubFiken();

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(calls).toEqual([]);
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "cancelled" });
	});

	it("fails the invoice when the company is gone", async () => {
		const f = await fixture();
		await approvedOrder(f);
		await f.t.run((ctx) => ctx.db.delete(f.companyId));
		stubFiken();

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "failed",
			lastError: "Fant ikke bedriften til bestillingen.",
		});
	});

	it("fails an invoice with a VAT rate Fiken does not know", async () => {
		const f = await fixture();
		const orderId = await approvedOrder(f);
		await f.t.run(async (ctx) => {
			const order = await ctx.db.get(orderId);
			if (order) await ctx.db.patch(order.productId, { vatRate: 7 });
		});
		const calls = stubFiken();

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(calls).toEqual([]);
		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "failed",
			lastError: "Ukjent MVA-sats 7",
		});
	});
});

describe("company presentations", () => {
	it("schedules an invoice a month after the event and bills the event's product", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const { applicationId } = await bedpres(f);

		const dueAt = invoiceDueAt(EVENT_START);
		expect(await onlyInvoice(f.t)).toMatchObject({
			source: { kind: "companyApplication", applicationId },
			serviceAt: EVENT_START,
			dueAt,
			status: "scheduled",
		});

		const calls = stubFiken();
		await runSweep(f.t, dueAt);

		expect(calls[1]?.body).toEqual({
			name: "FJORDKODE AS",
			organizationNumber: "123456789",
			email: "faktura@fjordkode.no",
			customer: true,
		});
		expect(calls[2]?.body).toMatchObject({
			invoiceText: "Bedriftspresentasjon med Testbedrift, 2027-02-09",
			lines: [
				{
					description: "Bedriftspresentasjon",
					unitPrice: 3_000_000,
					quantity: 1,
					vatType: "HIGH",
				},
			],
		});
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "draft_created" });
	});

	it("bills the product and price stored on the event", async () => {
		const f = await fixture();
		const productId = await insertEventProduct(f.t, { eventType: undefined, vatRate: 15 });
		const { eventId } = await bedpres(f);
		await f.t.run((ctx) =>
			ctx.db.patch(eventId, {
				product: { productId, name: "Bedpres med rabatt", unitPriceOre: 2_000_000 },
			}),
		);
		const calls = stubFiken();

		await runSweep(f.t, invoiceDueAt(EVENT_START));

		expect(calls[2]?.body).toMatchObject({
			lines: [
				{
					description: "Bedpres med rabatt",
					unitPrice: 2_000_000,
					quantity: 1,
					vatType: "MEDIUM",
				},
			],
		});
	});

	it("follows the event when its date moves", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const { applicationId } = await bedpres(f);

		await f.t.run((ctx) => ctx.db.patch(applicationId, { assignedDate: "2027-03-02" }));
		await f.editor.mutation(api.semesterPlanning.applications.mutations.createEvent, {
			applicationId,
		});

		const movedStart = Date.parse("2027-03-02T15:15:00Z");
		expect(await onlyInvoice(f.t)).toMatchObject({
			serviceAt: movedStart,
			dueAt: invoiceDueAt(movedStart),
			status: "scheduled",
		});
	});

	it("waits for an event that was moved later without rescheduling", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const { eventId } = await bedpres(f);
		const laterStart = EVENT_START + 7 * 24 * HOUR_IN_MS;
		await f.t.run((ctx) => ctx.db.patch(eventId, { eventStart: laterStart }));
		const calls = stubFiken();

		await runSweep(f.t, invoiceDueAt(EVENT_START));

		expect(calls).toEqual([]);
		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "scheduled",
			serviceAt: laterStart,
			dueAt: invoiceDueAt(laterStart),
			attempts: 0,
		});
	});

	it("cancels the invoice when the application is withdrawn, and schedules it again later", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const { applicationId } = await bedpres(f);

		await f.editor.mutation(api.semesterPlanning.applications.mutations.withdraw, {
			applicationId,
		});
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "cancelled" });

		await f.t.run((ctx) =>
			ctx.db.patch(applicationId, { status: "confirmed", assignedDate: "2027-02-09" }),
		);
		await f.editor.mutation(api.semesterPlanning.applications.mutations.createEvent, {
			applicationId,
		});
		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "scheduled",
			dueAt: invoiceDueAt(EVENT_START),
		});
	});

	it("cancels the invoice when the application lost its event before it was due", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const { applicationId } = await bedpres(f);
		await f.t.run((ctx) => ctx.db.patch(applicationId, { status: "withdrawn" }));
		stubFiken();

		await runSweep(f.t, invoiceDueAt(EVENT_START));

		expect(await onlyInvoice(f.t)).toMatchObject({ status: "cancelled" });
	});

	it("cancels the invoice when the application is gone", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const { applicationId } = await bedpres(f);
		await f.t.run((ctx) => ctx.db.delete(applicationId));
		stubFiken();

		await runSweep(f.t, invoiceDueAt(EVENT_START));

		expect(await onlyInvoice(f.t)).toMatchObject({ status: "cancelled" });
	});

	it("fails the invoice when no product has a price", async () => {
		const f = await fixture();
		await insertEventProduct(f.t, { unitPriceOre: undefined });
		await bedpres(f);
		stubFiken();

		await runSweep(f.t, invoiceDueAt(EVENT_START));

		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "failed",
			lastError: "Arrangementet mangler et produkt med pris.",
		});
	});

	it("leaves a created draft alone when the event moves or is withdrawn", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const { applicationId } = await bedpres(f);
		stubFiken();
		await runSweep(f.t, invoiceDueAt(EVENT_START));

		await f.t.run((ctx) => ctx.db.patch(applicationId, { assignedDate: "2027-03-02" }));
		await f.editor.mutation(api.semesterPlanning.applications.mutations.createEvent, {
			applicationId,
		});
		await f.editor.mutation(api.semesterPlanning.applications.mutations.withdraw, {
			applicationId,
		});

		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "draft_created",
			serviceAt: EVENT_START,
		});
	});
});

describe("failures", () => {
	it("retries a Fiken outage with backoff, then gives up after three attempts", async () => {
		const f = await fixture();
		await approvedOrder(f);
		const calls = stubFiken({ contacts: () => new Response("nede", { status: 503 }) });
		const firstDue = invoiceDueAt(NOW);

		await runSweep(f.t, firstDue);
		const first = await onlyInvoice(f.t);
		expect(first).toMatchObject({
			status: "scheduled",
			attempts: 1,
			lastError: "Fiken svarte 503: nede",
		});
		expect(first.dueAt - firstDue).toBeGreaterThanOrEqual(HOUR_IN_MS);

		await runSweep(f.t, first.dueAt);
		const second = await onlyInvoice(f.t);
		expect(second).toMatchObject({ status: "scheduled", attempts: 2 });
		expect(second.dueAt - first.dueAt).toBeGreaterThanOrEqual(2 * HOUR_IN_MS);

		await runSweep(f.t, second.dueAt);
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "failed", attempts: 3 });
		expect(calls).toHaveLength(3);
	});

	it("retries when Fiken cannot be reached", async () => {
		const f = await fixture();
		await approvedOrder(f);
		stubFiken({ contacts: () => new TypeError("fetch failed") });

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "scheduled",
			lastError: "Fiken svarte ikke: TypeError: fetch failed",
		});
	});

	it("fails at once when Fiken rejects the request", async () => {
		const f = await fixture();
		await approvedOrder(f);
		stubFiken({ createDraft: () => new Response("ugyldig", { status: 400 }) });

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "failed",
			fikenContactId: 77,
			lastError: "Fiken svarte 400: ugyldig",
		});
	});

	it("fails when Fiken does not say where the draft was created", async () => {
		const f = await fixture();
		await approvedOrder(f);
		stubFiken({ createDraft: () => new Response(null, { status: 201 }) });

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "failed",
			lastError: "Fiken svarte uten Location-header",
		});
	});

	it("waits for Fiken to be configured before sending anything", async () => {
		const f = await fixture();
		await approvedOrder(f);
		vi.stubEnv("FIKEN_COMPANY_SLUG", "");
		const calls = stubFiken();

		expect(await runSweep(f.t, invoiceDueAt(NOW))).toBe(0);

		expect(calls).toEqual([]);
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "scheduled", attempts: 0 });
	});

	it("fails a retry when Fiken is not configured", async () => {
		const f = await fixture();
		await approvedOrder(f);
		stubFiken({ createDraft: () => new Response("ugyldig", { status: 400 }) });
		await runSweep(f.t, invoiceDueAt(NOW));
		const failed = await onlyInvoice(f.t);
		vi.stubEnv("FIKEN_API_TOKEN", "");

		await f.admin.mutation(api.invoicing.admin.retry, { invoiceId: failed._id });
		await f.t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await onlyInvoice(f.t)).toMatchObject({
			status: "failed",
			lastError: "FIKEN_API_TOKEN og FIKEN_COMPANY_SLUG må være satt",
		});
	});

	it("uses Fiken's own address when no base URL is set", async () => {
		const f = await fixture();
		await approvedOrder(f);
		vi.stubEnv("FIKEN_API_BASE_URL", undefined);
		const fetch = vi.fn(async () => new Response("nei", { status: 401 }));
		vi.stubGlobal("fetch", fetch);

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(fetch).toHaveBeenCalledWith(
			"https://api.fiken.no/api/v2/companies/navet/contacts?organizationNumber=123456789&customer=true",
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer fiken-token" }),
			}),
		);
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "failed" });
	});

	it("reports an error that is not an Error", async () => {
		const f = await fixture();
		await approvedOrder(f);
		stubFiken({
			contacts: () =>
				({ ok: true, json: () => Promise.reject("ikke JSON") }) as unknown as Response,
		});

		await runSweep(f.t, invoiceDueAt(NOW));

		expect(await onlyInvoice(f.t)).toMatchObject({ status: "failed", lastError: "ikke JSON" });
	});
});

describe("processing", () => {
	it("sweeps due invoices in batches", async () => {
		const f = await fixture();
		const orderId = await insertConfirmedOrder(f);
		await f.t.run(async (ctx) => {
			for (let i = 0; i < 51; i++) {
				await ctx.db.insert("invoices", {
					source: { kind: "jobListingOrder", orderId },
					sourceKey: `batch:${i}`,
					serviceAt: NOW,
					dueAt: NOW,
					status: "scheduled",
					attempts: 0,
				});
			}
		});
		stubFiken();

		expect(await runSweep(f.t, NOW, 1000)).toBe(50);

		const statuses = (await invoices(f.t)).map((invoice) => invoice.status);
		expect(statuses).toEqual(Array(51).fill("cancelled"));
	});

	it("does nothing with an invoice that is not queued", async () => {
		const f = await fixture();
		await approvedOrder(f);
		const invoice = await onlyInvoice(f.t);
		const calls = stubFiken();

		await f.t.action(internal.invoicing.processing.createDraft, { invoiceId: invoice._id });

		expect(calls).toEqual([]);
		expect(await onlyInvoice(f.t)).toMatchObject({ status: "scheduled" });
	});

	it("ignores a failure for an invoice that is gone", async () => {
		const f = await fixture();
		await approvedOrder(f);
		const invoice = await onlyInvoice(f.t);
		await f.t.run((ctx) => ctx.db.delete(invoice._id));

		await f.t.mutation(internal.invoicing.processing.recordFailure, {
			invoiceId: invoice._id,
			error: "borte",
			retryable: true,
		});

		expect(await invoices(f.t)).toEqual([]);
	});
});

describe("admin", () => {
	it("lists invoices with the company they bill", async () => {
		const f = await fixture();
		await insertEventProduct(f.t);
		const orderId = await approvedOrder(f);
		const { applicationId } = await bedpres(f);

		const listed = await f.admin.query(api.invoicing.admin.list, {});

		expect(listed).toEqual([
			expect.objectContaining({ kind: "companyApplication", companyName: "FJORDKODE AS" }),
			expect.objectContaining({ kind: "jobListingOrder", companyName: "Testbedrift" }),
		]);

		await f.t.run(async (ctx) => {
			await ctx.db.delete(orderId);
			await ctx.db.delete(applicationId);
		});
		const orphaned = await f.admin.query(api.invoicing.admin.list, {});
		expect(orphaned.map((invoice) => invoice.companyName)).toEqual(["", ""]);
	});

	it("is closed to everyone but admins", async () => {
		const f = await fixture();
		await approvedOrder(f);
		const invoice = await onlyInvoice(f.t);

		await expect(f.editor.query(api.invoicing.admin.list, {})).rejects.toThrow();
		await expect(
			f.editor.mutation(api.invoicing.admin.retry, { invoiceId: invoice._id }),
		).rejects.toThrow();
	});

	it("retries a failed invoice", async () => {
		const f = await fixture();
		await approvedOrder(f);
		stubFiken({ createDraft: () => new Response("ugyldig", { status: 400 }) });
		await runSweep(f.t, invoiceDueAt(NOW));
		const failed = await onlyInvoice(f.t);
		const calls = stubFiken();

		await f.admin.mutation(api.invoicing.admin.retry, { invoiceId: failed._id });
		await f.t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(calls.map((call) => call.path)).toEqual(["/invoices/drafts"]);
		const retried = await onlyInvoice(f.t);
		expect(retried).toMatchObject({ status: "draft_created", attempts: 1 });
		expect(retried.lastError).toBeUndefined();
	});

	it("refuses to retry an invoice that has not failed", async () => {
		const f = await fixture();
		await approvedOrder(f);
		const invoice = await onlyInvoice(f.t);

		expect(
			await refusalMessageFrom(
				f.admin.mutation(api.invoicing.admin.retry, { invoiceId: invoice._id }),
			),
		).toBe("Bare fakturaer som feilet kan prøves på nytt.");
	});
});
