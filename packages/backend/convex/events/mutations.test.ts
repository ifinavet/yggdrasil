import { describe, expect, it } from "vitest";
import {
	asUser,
	emailsWithStatus,
	grantRole,
	insertEvent,
	insertRegistration,
	insertUser,
	scheduledRecipientsOf,
	setup,
	statusOf,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";

const eventMutations = internal.events.mutations;

describe("updateWaitlistMutation", () => {
	it("offers the new places to the front of the queue in order", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });
		const firstWaiting = await insertUser(t, "venter-1@example.com");
		await insertRegistration(t, eventId, firstWaiting._id, "waitlist", now);
		const secondWaiting = await insertUser(t, "venter-2@example.com");
		await insertRegistration(t, eventId, secondWaiting._id, "waitlist", now + 1);
		const thirdWaiting = await insertUser(t, "venter-3@example.com");
		const thirdWaitingId = await insertRegistration(
			t,
			eventId,
			thirdWaiting._id,
			"waitlist",
			now + 2,
		);

		await t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 2 });

		expect(await emailsWithStatus(t, eventId, "pending")).toEqual([
			"venter-1@example.com",
			"venter-2@example.com",
		]);
		expect(await statusOf(t, thirdWaitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([
			"venter-1@example.com",
			"venter-2@example.com",
		]);
	});

	it("offers nothing when there are no new places", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });
		const waiting = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waiting._id, "waitlist");

		await t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 0 });

		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([]);
	});

	it("stops at the participation limit even when asked for more places", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const firstWaiting = await insertUser(t, "venter-1@example.com");
		await insertRegistration(t, eventId, firstWaiting._id, "waitlist", now);
		const secondWaiting = await insertUser(t, "venter-2@example.com");
		const secondWaitingId = await insertRegistration(
			t,
			eventId,
			secondWaiting._id,
			"waitlist",
			now + 1,
		);

		await t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 5 });

		expect(await emailsWithStatus(t, eventId, "pending")).toEqual(["venter-1@example.com"]);
		expect(await statusOf(t, secondWaitingId)).toBe("waitlist");
	});

	it("refuses an event that no longer exists", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		await t.run((ctx) => ctx.db.delete(eventId));

		await expect(
			t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 1 }),
		).rejects.toThrow("ble ikke funnet");
	});
});

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
