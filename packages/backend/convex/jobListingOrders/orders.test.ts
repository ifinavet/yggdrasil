import type { EmailId, SendEmailOptions } from "@convex-dev/resend";
import { HUGIN_URL } from "@workspace/shared/constants";
import { osloToday } from "@workspace/shared/time";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { brregUnit, stubRegistries, VALID_ORG_NUMBER } from "../../test/registryFetch";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { orderResend } from "./emails";

const LISTING_PRODUCT = {
	name: "Stillingsannonse",
	shortDescription: "Annonse på ifinavet.no",
	longDescription: "",
	category: "job_listing" as const,
	vatRate: 25,
	volumeTiers: [
		{ quantity: 1, totalPriceOre: 300_000 },
		{ quantity: 2, totalPriceOre: 550_000 },
		{ quantity: 3, totalPriceOre: 750_000 },
	],
	startupPriceOre: 50_000,
	sortOrder: 1,
	active: true,
};

const billing = {
	address: "Storgata 12, 0155 Oslo",
	email: "faktura@fjordkode.no",
	reference: "Ingrid",
};

function futureDate(days: number) {
	return osloToday(Date.now() + days * DAY_IN_MS);
}

function listing(title: string) {
	return {
		title,
		teaser: "Bli med og bygg betalingsløsninger.",
		description: "<p>Du jobber med backend.</p><script>alert(1)</script>",
		applicationUrl: "https://fjordkode.no/jobb",
		deadline: futureDate(30),
		type: "Fulltid",
	};
}

let submissionCounter = 0;
function nextSubmissionId() {
	submissionCounter += 1;
	return `order-${submissionCounter}-abcdef`;
}

async function fixture() {
	const { t, companyId } = await setup();
	const productId = await t.run((ctx) => ctx.db.insert("products", LISTING_PRODUCT));
	const admin = await insertUser(t, "admin@ifinavet.no");
	await grantRole(t, admin._id, "internal");
	return { t, companyId, productId, adminId: admin._id, adminClient: asUser(t, admin) };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

function existingCompanyForm(f: Fixture, overrides: Record<string, unknown> = {}) {
	return {
		company: { kind: "existing" as const, companyId: f.companyId },
		productId: f.productId,
		startup: false,
		listings: [listing("Backendutvikler"), listing("Frontendutvikler")],
		contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no", phone: "+47 412 34 567" },
		billing,
		confirmAmount: true as const,
		...overrides,
	};
}

async function uploadLogo(t: TestBackend, contentType = "image/png") {
	return t.run(async (ctx) => {
		const storageId = await ctx.storage.store(new Blob(["logo"]));
		// biome-ignore lint/suspicious/noExplicitAny: convex-test drops the upload content type, which Convex records on real uploads.
		await (ctx.db as any).patch(storageId, { contentType });
		return storageId;
	});
}

function sentEmails() {
	return vi.spyOn(orderResend, "sendEmail").mockResolvedValue("email-id" as EmailId);
}

function emailsFrom(spy: ReturnType<typeof sentEmails>) {
	return spy.mock.calls.map((call) => (call as unknown as [unknown, SendEmailOptions])[1]);
}

function tokenFrom(html: string | undefined) {
	const token = html?.match(/bekreft#token=([\w-]+)/)?.[1];
	if (!token) throw new Error("No confirmation link in the email");
	return token;
}

async function submitOrder(
	t: TestBackend,
	form: Record<string, unknown>,
	submissionId = nextSubmissionId(),
) {
	const spy = sentEmails();
	// biome-ignore lint/suspicious/noExplicitAny: tests send deliberately partial forms.
	await t.action(api.jobListingOrders.submit.submit, { form: form as any, submissionId });
	const emails = emailsFrom(spy);
	spy.mockClear();
	return { emails, token: emails.length ? tokenFrom(emails[0]?.html) : undefined, submissionId };
}

async function orders(t: TestBackend) {
	return t.run((ctx) => ctx.db.query("jobListingOrders").collect());
}

async function onlyOrder(t: TestBackend) {
	const [order] = await orders(t);
	if (!order) throw new Error("No order");
	return order;
}

beforeEach(() => {
	stubRegistries({ unit: brregUnit() });
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("submit", () => {
	it("stores the order unconfirmed and emails a confirmation link", async () => {
		const f = await fixture();
		const { emails } = await submitOrder(f.t, existingCompanyForm(f));

		const order = await onlyOrder(f.t);
		expect(order).toMatchObject({
			status: "awaiting_email",
			quantity: 2,
			priceOre: 550_000,
			productName: "Stillingsannonse",
			billing,
		});
		expect(order.reference).toMatch(/^JL-\d{4}-0001$/);
		expect(emails).toHaveLength(1);
		expect(emails[0]?.to).toBe("ingrid@fjordkode.no");
		expect(emails[0]?.html).toContain(`${HUGIN_URL}/bestill-stillingsannonse/bekreft#token=`);
	});

	it("prices a startup order per listing", async () => {
		const f = await fixture();
		await submitOrder(f.t, existingCompanyForm(f, { startup: true }));
		expect((await onlyOrder(f.t)).priceOre).toBe(100_000);
	});

	it("strips scripts from listing descriptions", async () => {
		const f = await fixture();
		await submitOrder(f.t, existingCompanyForm(f));
		const items = await f.t.run((ctx) => ctx.db.query("jobListingOrderItems").collect());
		expect(items.map((item) => item.description)).toEqual([
			"<p>Du jobber med backend.</p>",
			"<p>Du jobber med backend.</p>",
		]);
	});

	it("reuses the order when the same submission is sent twice", async () => {
		const f = await fixture();
		const first = await submitOrder(f.t, existingCompanyForm(f));
		const second = await submitOrder(f.t, existingCompanyForm(f), first.submissionId);

		expect(await orders(f.t)).toHaveLength(1);
		expect(second.token).not.toBe(first.token);
	});

	it("ignores a submission with the honeypot filled in", async () => {
		const f = await fixture();
		await f.t.action(api.jobListingOrders.submit.submit, {
			form: existingCompanyForm(f),
			submissionId: nextSubmissionId(),
			website: "https://spam.example",
		});
		expect(await orders(f.t)).toHaveLength(0);
	});

	it("requires billing when the company has none on file", async () => {
		const f = await fixture();
		const message = await refusalMessageFrom(
			submitOrder(f.t, existingCompanyForm(f, { billing: undefined })),
		);
		expect(message).toBe("Fyll inn fakturainformasjon.");
	});

	it("refuses orders while the form is closed", async () => {
		const f = await fixture();
		await f.t.run((ctx) =>
			ctx.db.insert("jobListingOrderFormVersions", {
				intro: "Stengt",
				jobTypes: ["Fulltid"],
				titleMaxLength: 40,
				teaserMaxLength: 85,
				open: false,
				createdBy: f.adminId,
			}),
		);
		const message = await refusalMessageFrom(submitOrder(f.t, existingCompanyForm(f)));
		expect(message).toBe("Bestillingsskjemaet er stengt.");
	});

	it("refuses a new company that is already registered", async () => {
		const f = await fixture();
		await f.t.run((ctx) => ctx.db.patch(f.companyId, { orgNumber: Number(VALID_ORG_NUMBER) }));
		const logo = await uploadLogo(f.t);
		const message = await refusalMessageFrom(
			submitOrder(
				f.t,
				existingCompanyForm(f, {
					company: {
						kind: "new",
						orgNumber: VALID_ORG_NUMBER,
						displayName: "Fjordkode",
						description: "<p>Vi lager programvare.</p>",
						logo,
					},
				}),
			),
		);
		expect(message).toBe("Bedriften er allerede registrert. Velg den fra listen.");
	});

	it("refuses a logo that is not PNG or SVG", async () => {
		const f = await fixture();
		const logo = await uploadLogo(f.t, "image/gif");
		const message = await refusalMessageFrom(
			submitOrder(f.t, existingCompanyForm(f, { companyChanges: { logo } })),
		);
		expect(message).toBe("Logoen må være PNG eller SVG.");
	});
});

describe("confirm", () => {
	it("confirms the order, returns a receipt and sends receipt and admin notice", async () => {
		vi.useFakeTimers();
		const f = await fixture();
		const { token } = await submitOrder(f.t, existingCompanyForm(f));
		const spy = sentEmails();

		const result = await f.t.mutation(api.jobListingOrders.orders.confirm, { token: token ?? "" });
		await f.t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(result).toMatchObject({
			state: "confirmed",
			receipt: {
				companyName: "Testbedrift",
				quantity: 2,
				priceOre: 550_000,
				titles: ["Backendutvikler", "Frontendutvikler"],
				updateRequested: false,
			},
		});
		expect((await onlyOrder(f.t)).status).toBe("confirmed");
		expect(emailsFrom(spy).map((email) => email.to)).toEqual([
			"ingrid@fjordkode.no",
			"annonse@ifinavet.no",
		]);
	});

	it("shows the same receipt when the link is opened again", async () => {
		const f = await fixture();
		const { token } = await submitOrder(f.t, existingCompanyForm(f));
		const first = await f.t.mutation(api.jobListingOrders.orders.confirm, { token: token ?? "" });
		const again = await f.t.mutation(api.jobListingOrders.orders.confirm, { token: token ?? "" });
		expect(again).toEqual(first);
	});

	it("answers invalid for an unknown token", async () => {
		const f = await fixture();
		const result = await f.t.mutation(api.jobListingOrders.orders.confirm, {
			token: "x".repeat(43),
		});
		expect(result).toEqual({ state: "invalid" });
	});

	it("answers expired after a day and purges the unconfirmed order", async () => {
		vi.useFakeTimers();
		const f = await fixture();
		const { token } = await submitOrder(f.t, existingCompanyForm(f));

		vi.advanceTimersByTime(DAY_IN_MS + 1);
		expect(await f.t.mutation(api.jobListingOrders.orders.confirm, { token: token ?? "" })).toEqual(
			{ state: "expired" },
		);

		await f.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await orders(f.t)).toHaveLength(0);
		const items = await f.t.run((ctx) => ctx.db.query("jobListingOrderItems").collect());
		expect(items).toHaveLength(0);
	});

	it("opens an update request when the company asked for changes", async () => {
		const f = await fixture();
		const { token } = await submitOrder(
			f.t,
			existingCompanyForm(f, { companyChanges: { displayName: "Testbedrift Norge" } }),
		);
		await f.t.mutation(api.jobListingOrders.orders.confirm, { token: token ?? "" });

		const requests = await f.t.run((ctx) => ctx.db.query("companyUpdateRequests").collect());
		expect(requests).toMatchObject([
			{
				status: "pending",
				changes: { displayName: "Testbedrift Norge" },
				previous: { displayName: "Testbedrift" },
			},
		]);
	});

	it("saves feedback on the receipt only after confirming", async () => {
		const f = await fixture();
		const { token = "" } = await submitOrder(f.t, existingCompanyForm(f));
		const early = await refusalMessageFrom(
			f.t.mutation(api.jobListingOrders.orders.saveFeedback, { token, feedback: "Fint" }),
		);
		expect(early).toBeTruthy();

		await f.t.mutation(api.jobListingOrders.orders.confirm, { token });
		await f.t.mutation(api.jobListingOrders.orders.saveFeedback, { token, feedback: "  Fint  " });
		expect((await onlyOrder(f.t)).feedback).toBe("Fint");
	});
});

async function confirmedOrder(f: Fixture, form: Record<string, unknown> = existingCompanyForm(f)) {
	const { token } = await submitOrder(f.t, form);
	vi.useFakeTimers();
	const spy = sentEmails();
	await f.t.mutation(api.jobListingOrders.orders.confirm, { token: token ?? "" });
	await f.t.finishAllScheduledFunctions(vi.runAllTimers);
	spy.mockClear();
	return (await onlyOrder(f.t))._id;
}

describe("admin review", () => {
	it("lists confirmed orders for internal members only", async () => {
		const f = await fixture();
		await confirmedOrder(f);

		const pending = await f.adminClient.query(api.jobListingOrders.admin.listPending, {});
		expect(pending).toMatchObject([
			{ companyName: "Testbedrift", quantity: 2, updatePending: false },
		]);
		expect(
			await refusalMessageFrom(f.t.query(api.jobListingOrders.admin.listPending, {})),
		).toBeTruthy();
	});

	it("publishes the listings, saves billing on the company and emails the contact", async () => {
		vi.useFakeTimers();
		const f = await fixture();
		const orderId = await confirmedOrder(f);
		const spy = sentEmails();

		await f.adminClient.mutation(api.jobListingOrders.admin.approve, { orderId });
		await f.t.finishAllScheduledFunctions(vi.runAllTimers);

		const listings = await f.t.run((ctx) => ctx.db.query("jobListings").collect());
		expect(listings.map((row) => [row.title, row.published, row.company])).toEqual([
			["Backendutvikler", true, f.companyId],
			["Frontendutvikler", true, f.companyId],
		]);
		const company = await f.t.run((ctx) => ctx.db.get(f.companyId));
		expect(company?.billing).toEqual(billing);
		expect((await onlyOrder(f.t)).status).toBe("published");
		const [published] = emailsFrom(spy);
		expect(published?.html).toContain(`/job-listings/${listings[0]?._id}`);
	});

	it("blocks publishing until the update request is decided, then applies it", async () => {
		const f = await fixture();
		const orderId = await confirmedOrder(
			f,
			existingCompanyForm(f, { companyChanges: { displayName: "Testbedrift Norge" } }),
		);

		const blocked = await refusalMessageFrom(
			f.adminClient.mutation(api.jobListingOrders.admin.approve, { orderId }),
		);
		expect(blocked).toContain("endringen");

		const review = await f.adminClient.query(api.jobListingOrders.admin.getOrder, { orderId });
		await f.adminClient.mutation(api.jobListingOrders.admin.decideUpdate, {
			requestId: review?.update?._id as Id<"companyUpdateRequests">,
			approve: true,
		});
		await f.adminClient.mutation(api.jobListingOrders.admin.approve, { orderId });

		const company = await f.t.run((ctx) => ctx.db.get(f.companyId));
		expect(company?.name).toBe("Testbedrift Norge");
	});

	it("creates the company from brreg and the form when a new company is approved", async () => {
		const f = await fixture();
		const logo = await uploadLogo(f.t);
		const orderId = await confirmedOrder(
			f,
			existingCompanyForm(f, {
				company: {
					kind: "new",
					orgNumber: VALID_ORG_NUMBER,
					displayName: "Fjordkode",
					description: "<p>Vi lager programvare.</p>",
					logo,
				},
			}),
		);

		await f.adminClient.mutation(api.jobListingOrders.admin.approve, { orderId });

		const created = await f.t.run((ctx) =>
			ctx.db
				.query("companies")
				.withIndex("by_orgNumber", (q) => q.eq("orgNumber", Number(VALID_ORG_NUMBER)))
				.unique(),
		);
		expect(created).toMatchObject({
			name: "Fjordkode",
			registryName: "FJORDKODE AS",
			description: "<p>Vi lager programvare.</p>",
			billing,
		});
	});

	it("rejects with a reason, closes the update request and emails the contact", async () => {
		vi.useFakeTimers();
		const f = await fixture();
		const orderId = await confirmedOrder(
			f,
			existingCompanyForm(f, { companyChanges: { displayName: "Testbedrift Norge" } }),
		);
		const spy = sentEmails();

		await f.adminClient.mutation(api.jobListingOrders.admin.reject, {
			orderId,
			reason: "Lenken virker ikke.",
		});
		await f.t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await onlyOrder(f.t)).toMatchObject({
			status: "rejected",
			rejectionReason: "Lenken virker ikke.",
		});
		const requests = await f.t.run((ctx) => ctx.db.query("companyUpdateRequests").collect());
		expect(requests.map((request) => request.status)).toEqual(["rejected"]);
		expect(emailsFrom(spy)[0]?.html).toContain("Lenken virker ikke.");
	});

	it("lets an admin fix a listing before publishing", async () => {
		const f = await fixture();
		const orderId = await confirmedOrder(f);
		const review = await f.adminClient.query(api.jobListingOrders.admin.getOrder, { orderId });
		const item = review?.items[0];
		if (!item) throw new Error("No item");

		await f.adminClient.mutation(api.jobListingOrders.admin.updateItem, {
			itemId: item._id,
			title: "Backendutvikler i Oslo",
			teaser: item.teaser,
			description: item.description,
			applicationUrl: item.applicationUrl,
			deadline: item.deadline,
			type: item.type,
		});

		const updated = await f.adminClient.query(api.jobListingOrders.admin.getOrder, { orderId });
		expect(updated?.items[0]?.title).toBe("Backendutvikler i Oslo");
	});
});
