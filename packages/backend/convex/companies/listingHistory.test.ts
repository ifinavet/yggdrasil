import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

async function setupHistory() {
	const { t, companyId } = await setup();
	const user = await insertUser(t, "history@example.test");
	await grantRole(t, user._id, "internal");
	const client = asUser(t, user);
	const listing = {
		title: "Utvikler",
		type: "Fulltid",
		teaser: "Bli med",
		description: "Jobb hos oss",
		applicationUrl: "https://example.test/apply",
		published: true,
		company: companyId,
		deadline: 1,
	};
	return { t, companyId, client, listing };
}

async function orderFixture(
	t: Awaited<ReturnType<typeof setup>>["t"],
	companyId: Doc<"companies">["_id"],
) {
	const productId = await t.run((ctx) =>
		ctx.db.insert("products", {
			name: "Annonse",
			shortDescription: "",
			longDescription: "",
			category: "job_listing",
			vatRate: 25,
			sortOrder: 0,
			active: true,
		}),
	);
	return {
		companyId,
		productId,
		productName: "Annonse",
		startup: false,
		quantity: 2,
		priceOre: 100_000,
		contact: { name: "Ada", email: "ada@example.test" },
		status: "published" as const,
	};
}

function orderItem(listing: Awaited<ReturnType<typeof setupHistory>>["listing"]) {
	const { published: _published, company: _company, deadline: _deadline, ...fields } = listing;
	return { ...fields, deadline: "2020-01-01" };
}

describe("company listing history", () => {
	it("shows legacy and manual listings for their company, including expired and hidden listings", async () => {
		const { t, companyId, client, listing } = await setupHistory();
		const { publishedId, draftId, otherId, createdAt } = await t.run(async (ctx) => {
			const company = await ctx.db.get(companyId);
			if (!company) throw new Error("Missing company");
			const otherCompany = await ctx.db.insert("companies", {
				name: "Other",
				orgNumber: 987654321,
				description: "",
				mainSponsor: false,
				logo: company.logo,
			});
			const publishedId = await ctx.db.insert("jobListings", { ...listing, publishedAt: 0 });
			const draftId = await ctx.db.insert("jobListings", {
				...listing,
				title: "Manuell annonse",
				published: false,
			});
			const otherId = await ctx.db.insert("jobListings", { ...listing, company: otherCompany });
			return {
				publishedId,
				draftId,
				otherId,
				createdAt: (await ctx.db.get(draftId))?._creationTime,
			};
		});
		const history = await client.query(api.companies.history.getHistory, { companyId });
		expect(history.find((entry) => entry.id === `listing-${publishedId}`)).toMatchObject({
			at: 0,
			label: "Stillingsannonse: Utvikler",
			dateLabel: "Publisert",
			detail: "Publisert",
			href: `/job-listings/${publishedId}`,
		});
		expect(history.find((entry) => entry.id === `listing-${draftId}`)).toMatchObject({
			at: createdAt,
			dateLabel: "Opprettet",
			detail: "Ikke publisert",
		});
		expect(history.some((entry) => entry.id === `listing-${otherId}`)).toBe(false);
		expect(history.map((entry) => entry.at)).toEqual(
			history.map((entry) => entry.at).sort((a, b) => b - a),
		);
		const student = asUser(t, await insertUser(t, "student-history@example.test"));
		await expect(student.query(api.companies.history.getHistory, { companyId })).rejects.toThrow();
		await expect(t.query(api.companies.history.getHistory, { companyId })).rejects.toThrow();
	});

	it("shows an order once instead of its linked listings, preserving unlinked listings with the same title", async () => {
		const { t, companyId, client, listing } = await setupHistory();
		const order = await orderFixture(t, companyId);
		const { orderId, linkedIds, unlinkedId } = await t.run(async (ctx) => {
			const orderId = await ctx.db.insert("jobListingOrders", {
				...order,
				reference: "ORDER-1",
				submissionId: "order-1",
			});
			const linkedIds = [];
			for (let position = 0; position < 2; position++) {
				const jobListingId = await ctx.db.insert("jobListings", listing);
				linkedIds.push(jobListingId);
				await ctx.db.insert("jobListingOrderItems", {
					...orderItem(listing),
					orderId,
					position,
					jobListingId,
				});
			}
			return { orderId, linkedIds, unlinkedId: await ctx.db.insert("jobListings", listing) };
		});
		const history = await client.query(api.companies.history.getHistory, { companyId });
		expect(history.filter((entry) => entry.id === `order-${orderId}`)).toHaveLength(1);
		expect(history.filter((entry) => entry.id.startsWith("listing-"))).toEqual([
			expect.objectContaining({ id: `listing-${unlinkedId}` }),
		]);
		await t.run((ctx) => ctx.db.delete(orderId));
		const afterDeletion = await client.query(api.companies.history.getHistory, { companyId });
		for (const id of linkedIds)
			expect(afterDeletion.some((entry) => entry.id === `listing-${id}`)).toBe(true);
	});

	it("keeps a listing when its order falls outside the order history window", async () => {
		const { t, companyId, client, listing } = await setupHistory();
		const order = await orderFixture(t, companyId);
		const oldOrderId = await t.run((ctx) =>
			ctx.db.insert("jobListingOrders", { ...order, reference: "OLD", submissionId: "old" }),
		);
		// Separate transactions ensure newer orders have later creation times.
		for (let i = 0; i < 50; i++)
			await t.run((ctx) =>
				ctx.db.insert("jobListingOrders", {
					...order,
					reference: `NEW-${i}`,
					submissionId: `new-${i}`,
				}),
			);
		const jobListingId = await t.run(async (ctx) => {
			const id = await ctx.db.insert("jobListings", listing);
			await ctx.db.insert("jobListingOrderItems", {
				...orderItem(listing),
				orderId: oldOrderId,
				position: 0,
				jobListingId: id,
			});
			return id;
		});
		const history = await client.query(api.companies.history.getHistory, { companyId });
		expect(history.some((entry) => entry.id === `order-${oldOrderId}`)).toBe(false);
		expect(history.some((entry) => entry.id === `listing-${jobListingId}`)).toBe(true);
	});
});
