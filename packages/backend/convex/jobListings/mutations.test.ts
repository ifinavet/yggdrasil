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
		expect(listing?.product).toEqual({ productId, name: jobListingProduct.name, vatRate: 25 });
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
		expect(listing?.product).toEqual({ productId, name: jobListingProduct.name, vatRate: 25 });
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

	it("publishes a draft from the list and records the publish time", async () => {
		const { t, companyId, client } = await fixture();
		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
			published: false,
			deadline: Date.now() + DAY_IN_MS,
		});
		const before = Date.now();

		await client.mutation(api.jobListings.mutations.setPublished, {
			id: listingId,
			published: true,
		});

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.published).toBe(true);
		expect(listing?.publishedAt).toBeGreaterThanOrEqual(before);
	});

	it("refuses to publish a draft whose deadline is past the cap", async () => {
		const { t, companyId, client } = await fixture();
		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
			published: false,
			deadline: jobListingLatestDeadline(Date.now()) + 30 * DAY_IN_MS,
		});

		const refusal = await refusalMessageFrom(
			client.mutation(api.jobListings.mutations.setPublished, {
				id: listingId,
				published: true,
			}),
		);

		expect(refusal).toContain("6 måneder");
		expect((await t.run((ctx) => ctx.db.get(listingId)))?.published).toBe(false);
	});

	it("unpublishes a listing and keeps its first publish time", async () => {
		const { t, companyId, client } = await fixture();
		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
		});
		const publishedAt = (await t.run((ctx) => ctx.db.get(listingId)))?.publishedAt;

		await client.mutation(api.jobListings.mutations.setPublished, {
			id: listingId,
			published: false,
		});

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.published).toBe(false);
		expect(listing?.publishedAt).toBe(publishedAt);
	});

	it.each(["update", "setPublished"] as const)(
		"allows %s to unpublish a legacy listing past its deadline cap",
		async (method) => {
			const { t, companyId, client } = await fixture();
			const { contacts: _contacts, ...fields } = listingArgs;
			const deadline = jobListingLatestDeadline(Date.now()) + DAY_IN_MS;
			const id = await t.run((ctx) =>
				ctx.db.insert("jobListings", { ...fields, company: companyId, deadline }),
			);
			const original = await t.run((ctx) => ctx.db.get(id));
			if (method === "update") {
				await client.mutation(api.jobListings.mutations.update, {
					...listingArgs,
					id,
					company: companyId,
					deadline,
					published: false,
				});
			} else {
				await client.mutation(api.jobListings.mutations.setPublished, { id, published: false });
			}
			expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
				published: false,
				publishedAt: original?._creationTime,
				deadline,
			});
			await expect(
				client.mutation(api.jobListings.mutations.setPublished, {
					id,
					published: true,
				}),
			).rejects.toThrow("6 måneder");
		},
	);

	it("refuses to change the published state for users without an internal role", async () => {
		const { t, companyId, client } = await fixture();
		const listingId = await client.mutation(api.jobListings.mutations.create, {
			...listingArgs,
			company: companyId,
		});
		const outsider = asUser(t, await insertUser(t, "outsider@example.test"));

		await expect(
			outsider.mutation(api.jobListings.mutations.setPublished, {
				id: listingId,
				published: false,
			}),
		).rejects.toThrow();
		expect((await t.run((ctx) => ctx.db.get(listingId)))?.published).toBe(true);
	});
});
