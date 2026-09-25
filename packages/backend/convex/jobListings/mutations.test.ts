import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

const jobListingProduct = {
	name: "Stillingsannonse",
	shortDescription: "",
	longDescription: "",
	category: "job_listing" as const,
	vatRate: 25,
	sortOrder: 0,
	active: true,
};

async function fixture() {
	const { t, companyId } = await setup();
	const user = await insertUser(t, "internal@example.test");
	await grantRole(t, user._id, "admin");
	return { t, companyId, client: asUser(t, user) };
}

const listingArgs = {
	title: "Sommerjobb",
	type: "internship",
	teaser: "",
	description: "",
	applicationUrl: "",
	published: true,
	deadline: Date.now(),
	contacts: [],
};

describe("jobListings.mutations", () => {
	it("snapshots the active job listing product on create", async () => {
		const { t, companyId, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", jobListingProduct));

		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
		});

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.product).toEqual({ productId, name: jobListingProduct.name });
	});

	it("preserves the product snapshot when the listing is updated", async () => {
		const { t, companyId, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", jobListingProduct));
		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
		});

		await client.mutation(api.jobListings.mutations.update, {
			...listingArgs,
			id: listingId,
			company: companyId,
			title: "Sommerjobb, revidert",
		});

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.product).toEqual({ productId, name: jobListingProduct.name });
		expect(listing?.title).toBe("Sommerjobb, revidert");
	});
});
