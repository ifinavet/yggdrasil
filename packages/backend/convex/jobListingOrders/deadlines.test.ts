import {
	JOB_LISTING_ORDER_DEFAULTS,
	orderListingSchema,
} from "@workspace/shared/job-listing-orders";
import { jobListingLatestDeadline, osloDateTimeToEpoch } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

const listing = {
	title: "Utvikler",
	teaser: "Bli med på laget",
	description: "<p>Utvikle tjenester</p>",
	applicationUrl: "https://example.test/jobs",
	type: "Fulltid",
};

afterEach(() => vi.useRealTimers());

describe("order deadlines", () => {
	it.each([
		["2026-08-31", "2027-02-28", "2027-03-01"],
		["2027-08-31", "2028-02-29", "2028-03-01"],
		["2026-09-30", "2027-03-30", "2027-03-31"],
	])("accepts the full sixth-month day from %s", (today, latest, tooLate) => {
		const schema = orderListingSchema(JOB_LISTING_ORDER_DEFAULTS, today);
		expect(schema.safeParse({ ...listing, deadline: today }).success).toBe(true);
		expect(schema.safeParse({ ...listing, deadline: latest }).success).toBe(true);
		expect(schema.safeParse({ ...listing, deadline: tooLate }).success).toBe(false);
		expect(schema.safeParse({ ...listing, deadline: "2026-02-30" }).success).toBe(false);
		expect(schema.safeParse({ ...listing, deadline: "2026-01-01" }).success).toBe(false);
		expect(jobListingLatestDeadline(osloDateTimeToEpoch(today, "12:00"))).toBe(
			osloDateTimeToEpoch(latest, "23:59") + 59_999,
		);
	});

	it.each([
		["2026-09-29", false],
		["2027-03-31", false],
		["not-a-date", false],
		["2027-03-30", true],
		["2026-09-30", true],
	])("checks deadline %s again before approval", async (deadline, allowed) => {
		vi.useFakeTimers();
		const now = osloDateTimeToEpoch("2026-09-30", "12:00");
		vi.setSystemTime(now);
		const { t, companyId } = await setup();
		const admin = await insertUser(t, "admin@example.test");
		await grantRole(t, admin._id, "admin");
		const orderId = await t.run(async (ctx) => {
			const productId = await ctx.db.insert("products", {
				name: "Annonse",
				shortDescription: "",
				longDescription: "",
				category: "job_listing",
				vatRate: 25,
				sortOrder: 0,
				active: true,
			});
			const id = await ctx.db.insert("jobListingOrders", {
				reference: "JOB-1",
				submissionId: "deadline-test",
				status: "confirmed",
				companyId,
				productId,
				productName: "Annonse",
				startup: false,
				quantity: 1,
				priceOre: 10000,
				contact: { name: "Ada", email: "ada@example.test" },
			});
			await ctx.db.insert("jobListingOrderItems", {
				...listing,
				deadline,
				orderId: id,
				position: 0,
			});
			return id;
		});
		const approval = asUser(t, admin).mutation(api.jobListingOrders.admin.approve, { orderId });
		if (allowed) await approval;
		else await expect(approval).rejects.toThrow();
		const stored = await t.run(async (ctx) => ({
			order: await ctx.db.get(orderId),
			listings: await ctx.db.query("jobListings").collect(),
			invoices: await ctx.db.query("invoices").collect(),
		}));
		expect(stored.order?.status).toBe(allowed ? "published" : "confirmed");
		expect(stored.listings).toHaveLength(allowed ? 1 : 0);
		if (allowed) {
			expect(stored.listings[0]).toMatchObject({ publishedAt: now, published: true });
		} else {
			expect(stored.invoices).toHaveLength(0);
		}
	});
});
