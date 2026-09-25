import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../test/fixtures";
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
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const editor = await insertUser(t, "editor@example.test");
	await grantRole(t, editor._id, "editor");
	return { t, companyId, admin: asUser(t, admin), editor: asUser(t, editor) };
}

const springEvent = new Date("2027-02-10T10:00:00Z").getTime();

describe("eventsForTagging", () => {
	it("refuses callers below admin", async () => {
		const { editor } = await fixture();
		await expect(
			refusalMessageFrom(
				editor.query(api.products.tagging.eventsForTagging, { semester: "vår", year: 2027 }),
			),
		).resolves.toContain("Unauthorized");
	});

	it("returns default fields and null company name when the company is missing", async () => {
		const { t, companyId, admin } = await fixture();
		const eventId = await insertEvent(t, companyId, { eventStart: springEvent });
		await t.run((ctx) => ctx.db.delete(companyId));

		const events = await admin.query(api.products.tagging.eventsForTagging, {
			semester: "vår",
			year: 2027,
		});
		expect(events).toEqual([
			expect.objectContaining({
				_id: eventId,
				companyName: null,
				product: null,
				productGuessed: false,
			}),
		]);
	});

	it("includes the tagged product and companyName when present", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		await insertEvent(t, companyId, {
			eventStart: springEvent,
			product: { productId, name: eventProduct.name, unitPriceOre: eventProduct.unitPriceOre },
			productGuessed: true,
		});

		const events = await admin.query(api.products.tagging.eventsForTagging, {
			semester: "vår",
			year: 2027,
		});
		expect(events).toEqual([
			expect.objectContaining({
				companyName: "Testbedrift",
				product: { productId, name: eventProduct.name, unitPriceOre: eventProduct.unitPriceOre },
				productGuessed: true,
			}),
		]);
	});
});

describe("bulkAssignEventProduct", () => {
	it("refuses an empty selection", async () => {
		const { t, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		await expect(
			refusalMessageFrom(
				admin.mutation(api.products.tagging.bulkAssignEventProduct, {
					eventIds: [],
					productId,
				}),
			),
		).resolves.toBe("Velg mellom 1 og 200 arrangementer.");
	});

	it("refuses more than 200 events", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const eventIds = await Promise.all(
			Array.from({ length: 201 }, () => insertEvent(t, companyId)),
		);

		await expect(
			refusalMessageFrom(
				admin.mutation(api.products.tagging.bulkAssignEventProduct, { eventIds, productId }),
			),
		).resolves.toBe("Velg mellom 1 og 200 arrangementer.");
	});

	it("refuses a missing event", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const eventId = await insertEvent(t, companyId);
		await t.run((ctx) => ctx.db.delete(eventId));

		await expect(
			refusalMessageFrom(
				admin.mutation(api.products.tagging.bulkAssignEventProduct, {
					eventIds: [eventId],
					productId,
				}),
			),
		).resolves.toBe("Arrangementet ble ikke funnet.");
	});

	it("refuses callers below admin", async () => {
		const { t, companyId, editor } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const eventId = await insertEvent(t, companyId);

		await expect(
			refusalMessageFrom(
				editor.mutation(api.products.tagging.bulkAssignEventProduct, {
					eventIds: [eventId],
					productId,
				}),
			),
		).resolves.toContain("Unauthorized");
	});

	it("patches events, clears the guessed flag and logs one change", async () => {
		const { t, companyId, admin } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const firstId = await insertEvent(t, companyId, { productGuessed: true });
		const secondId = await insertEvent(t, companyId, { productGuessed: true });

		const assigned = await admin.mutation(api.products.tagging.bulkAssignEventProduct, {
			eventIds: [firstId, secondId],
			productId,
		});
		expect(assigned).toBe(2);

		const first = await t.run((ctx) => ctx.db.get(firstId));
		const second = await t.run((ctx) => ctx.db.get(secondId));
		expect(first).toMatchObject({
			product: { productId, name: eventProduct.name, unitPriceOre: eventProduct.unitPriceOre },
		});
		expect(first?.productGuessed).toBeUndefined();
		expect(second?.product?.productId).toBe(productId);

		const changes = await t.run((ctx) =>
			ctx.db
				.query("productChanges")
				.withIndex("by_productId", (q) => q.eq("productId", productId))
				.collect(),
		);
		expect(changes).toMatchObject([
			{ action: "assigned", changes: [{ field: "assignedEvents", after: "2" }] },
		]);
	});
});
