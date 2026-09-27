import { jobListingLatestDeadline } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../test/fixtures";
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

	it("records the publish time and refuses a deadline more than six months later", async () => {
		const { t, companyId, client } = await fixture();
		const before = Date.now();

		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
			deadline: before + DAY_IN_MS,
		});
		const publishedAt = (await t.run((ctx) => ctx.db.get(listingId)))?.publishedAt ?? 0;
		expect(publishedAt).toBeGreaterThanOrEqual(before);

		const refusal = await refusalMessageFrom(
			client.mutation(api.jobListings.mutations.create, {
				...listingArgs,
				company: companyId,
				deadline: jobListingLatestDeadline(Date.now()) + DAY_IN_MS,
			}),
		);
		expect(refusal).toContain("6 måneder");
	});

	it("allows postponing the deadline up to six months after the first publish", async () => {
		const { t, companyId, client } = await fixture();
		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
		});
		const publishedAt = (await t.run((ctx) => ctx.db.get(listingId)))?.publishedAt ?? 0;
		const latest = jobListingLatestDeadline(publishedAt);

		await client.mutation(api.jobListings.mutations.update, {
			...listingArgs,
			id: listingId,
			company: companyId,
			deadline: latest,
		});
		expect((await t.run((ctx) => ctx.db.get(listingId)))?.deadline).toBe(latest);

		const refusal = await refusalMessageFrom(
			client.mutation(api.jobListings.mutations.update, {
				...listingArgs,
				id: listingId,
				company: companyId,
				deadline: latest + 1,
			}),
		);
		expect(refusal).toContain("6 måneder");
	});

	it("keeps the first publish time when a listing is unpublished and published again", async () => {
		const { t, companyId, client } = await fixture();
		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
		});
		const publishedAt = (await t.run((ctx) => ctx.db.get(listingId)))?.publishedAt;

		await client.mutation(api.jobListings.mutations.update, {
			...listingArgs,
			id: listingId,
			company: companyId,
			published: false,
		});
		await client.mutation(api.jobListings.mutations.update, {
			...listingArgs,
			id: listingId,
			company: companyId,
		});

		expect((await t.run((ctx) => ctx.db.get(listingId)))?.publishedAt).toBe(publishedAt);
	});

	it("does not cap drafts that have never been published", async () => {
		const { t, companyId, client } = await fixture();
		const deadline = jobListingLatestDeadline(Date.now()) + 30 * DAY_IN_MS;

		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
			published: false,
			deadline,
		});

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.publishedAt).toBeUndefined();
		expect(listing?.deadline).toBe(deadline);
	});

	it("measures legacy published listings from their creation time", async () => {
		const { t, companyId, client } = await fixture();
		const { contacts: _contacts, ...listingFields } = listingArgs;
		const listingId = await t.run((ctx) =>
			ctx.db.insert("jobListings", { ...listingFields, company: companyId }),
		);
		const creationTime = (await t.run((ctx) => ctx.db.get(listingId)))?._creationTime ?? 0;

		const refusal = await refusalMessageFrom(
			client.mutation(api.jobListings.mutations.update, {
				...listingArgs,
				id: listingId,
				company: companyId,
				deadline: jobListingLatestDeadline(creationTime) + 1,
			}),
		);
		expect(refusal).toContain("6 måneder");
	});
});
