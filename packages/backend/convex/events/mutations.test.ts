import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertEvent, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

const eventProduct = {
	name: "Ordinær bedriftspresentasjon",
	shortDescription: "",
	longDescription: "",
	category: "event" as const,
	unitPriceOre: 3_000_000,
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

const eventArgs = {
	title: "Testarrangement",
	teaser: "",
	description: "",
	eventStart: Date.now() + 86_400_000,
	registrationOpens: Date.now(),
	participationLimit: 10,
	location: "Ole-Johan Dahls hus",
	food: "",
	language: "norsk",
	ageRestriction: "",
	externalEvent: false,
	hostingCompany: undefined as unknown as string,
	published: true,
	organizers: [],
};

describe("events.mutations.create", () => {
	it("snapshots the chosen product", async () => {
		const { t, companyId, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));

		await client.mutation(api.events.mutations.create, {
			...eventArgs,
			hostingCompany: companyId,
			productId,
		});

		const event = await t.run((ctx) =>
			ctx.db
				.query("events")
				.filter((q) => q.eq(q.field("title"), eventArgs.title))
				.first(),
		);
		expect(event?.product).toEqual({
			productId,
			name: eventProduct.name,
			unitPriceOre: eventProduct.unitPriceOre,
		});
	});
});

describe("events.mutations.update", () => {
	it("snapshots a newly chosen product", async () => {
		const { t, companyId, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const eventId = await insertEvent(t, companyId);

		await client.mutation(api.events.mutations.update, {
			...eventArgs,
			id: eventId,
			hostingCompany: companyId,
			productId,
		});

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.product).toEqual({
			productId,
			name: eventProduct.name,
			unitPriceOre: eventProduct.unitPriceOre,
		});
	});

	it("keeps the existing snapshot when the same product is chosen again", async () => {
		const { t, companyId, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const eventId = await insertEvent(t, companyId, {
			product: { productId, name: eventProduct.name, unitPriceOre: eventProduct.unitPriceOre },
			productGuessed: true,
		});

		await client.mutation(api.events.mutations.update, {
			...eventArgs,
			id: eventId,
			hostingCompany: companyId,
			productId,
		});

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.product).toEqual({
			productId,
			name: eventProduct.name,
			unitPriceOre: eventProduct.unitPriceOre,
		});
		expect(event?.productGuessed).toBeUndefined();
	});
});
