import { FOOD_ITEMS, guessFoodItem } from "@workspace/shared/events/food";
import { nameKey } from "@workspace/shared/utils";
import { describe, expect, it, vi } from "vitest";
import {
	asUser,
	setupAdminAndEditor as fixture,
	insertEvent,
	insertFoodItem,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const springEvent = new Date("2027-02-10T10:00:00Z").getTime();

const slugOf = (t: TestBackend, id: Id<"events">) =>
	t.run(async (ctx) => {
		const event = await ctx.db.get(id);
		return event?.foodItem ? (await ctx.db.get(event.foodItem))?.slug : undefined;
	});

describe("guessFoodItem", () => {
	it.each([
		["Pizza", "pizza"],
		["Pizza fra Peppes", "pizza"],
		["SUSHI", "sushi"],
		["Burritos fra Freddy Fuego", "burritos"],
		["Tacos", "taco"],
		["Hamburgere", "burger"],
		["Bagetter", "baguettes"],
		["Thaimat", "asian"],
		["Kaffe og snacks", "coffee_snacks"],
		["Bánh mì fra Hanoi", "banh_mi"],
		["Banh mi", "banh_mi"],
		["Bagels", "bagels"],
		["Pokébowls", "poke_bowls"],
		["Poke bowl", "poke_bowls"],
		["Tapas", "tapas"],
	] as const)("maps %s to %s", (text, expected) => {
		expect(guessFoodItem(text)).toBe(expected);
	});

	it.each([
		[undefined],
		[""],
		["   "],
		["Mer info kommer"],
		["Pizza og sushi"],
		["Kaffe og kake"],
		["Middag"],
	])("leaves %j unresolved", (text) => {
		expect(guessFoodItem(text)).toBeNull();
	});
});

describe("backfillEventFood", () => {
	const migrate = (t: TestBackend) =>
		t.mutation(internal.events.food.backfillEventFood, {
			oneBatchOnly: true,
			cursor: null,
			dryRun: false,
		});
	const food = (t: TestBackend, id: Id<"events">) => t.run((ctx) => ctx.db.get(id));

	it("marks a keyword match as guessed and leaves unmatched text unset", async () => {
		const { t, companyId } = await setup();
		const matched = await insertEvent(t, companyId, { food: "Pizza fra Peppes" });
		const unmatched = await insertEvent(t, companyId, { food: "Middag" });

		await migrate(t);

		expect(await slugOf(t, matched)).toBe("pizza");
		expect(await food(t, matched)).toMatchObject({ foodGuessed: true });
		const left = await food(t, unmatched);
		expect(left?.foodItem).toBeUndefined();
		expect(left?.foodGuessed).toBeUndefined();
	});

	it("skips events that already have a food item", async () => {
		const { t, companyId } = await setup();
		const sushi = await insertFoodItem(t, "sushi");
		const eventId = await insertEvent(t, companyId, { food: "Pizza", foodItem: sushi });

		await migrate(t);

		const event = await food(t, eventId);
		expect(event?.foodItem).toBe(sushi);
		expect(event?.foodGuessed).toBeUndefined();
	});
});

describe("food backfill on page open", () => {
	it("guesses food once and reports when it is done", async () => {
		vi.useFakeTimers();
		const { t, companyId, editor } = await fixture();
		const eventId = await insertEvent(t, companyId, { food: "Sushi" });

		expect(await editor.query(api.events.food.backfillPending, {})).toBe(true);
		await editor.mutation(api.events.food.setupBackfill, {});
		await editor.mutation(api.events.food.setupBackfill, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await slugOf(t, eventId)).toBe("sushi");
		expect(await t.run((ctx) => ctx.db.get(eventId))).toMatchObject({ foodGuessed: true });
		expect(await editor.query(api.events.food.backfillPending, {})).toBe(false);
		expect(await t.run((ctx) => ctx.db.query("foodItems").collect())).toHaveLength(
			FOOD_ITEMS.length,
		);

		const later = await insertEvent(t, companyId, { food: "Pizza" });
		await editor.mutation(api.events.food.setupBackfill, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect((await t.run((ctx) => ctx.db.get(later)))?.foodItem).toBeUndefined();
		vi.useRealTimers();
	});

	it("refuses students", async () => {
		const { t } = await setup();
		const student = asUser(t, await insertUser(t, "student@example.test"));

		expect(
			await refusalMessageFrom(student.mutation(api.events.food.setupBackfill, {})),
		).toBeTruthy();
		expect(
			await refusalMessageFrom(student.query(api.events.food.backfillPending, {})),
		).toBeTruthy();
	});
});

describe("eventsForFoodTagging", () => {
	it("refuses callers below admin", async () => {
		const { editor } = await fixture();
		await expect(
			refusalMessageFrom(
				editor.query(api.events.food.eventsForFoodTagging, { semester: "vår", year: 2027 }),
			),
		).resolves.toContain("Unauthorized");
	});

	it("returns the legacy text and food state, drafts included", async () => {
		const { t, companyId, admin } = await fixture();
		const sushi = await insertFoodItem(t, "sushi");
		const guessed = await insertEvent(t, companyId, {
			eventStart: springEvent,
			food: "Sushi",
			foodItem: sushi,
			foodGuessed: true,
		});
		const draft = await insertEvent(t, companyId, { eventStart: springEvent, published: false });
		await t.run((ctx) => ctx.db.delete(companyId));

		const events = await admin.query(api.events.food.eventsForFoodTagging, {
			semester: "vår",
			year: 2027,
		});
		expect(events).toEqual([
			expect.objectContaining({
				_id: guessed,
				food: "Sushi",
				foodItem: sushi,
				foodGuessed: true,
				companyName: null,
			}),
			expect.objectContaining({
				_id: draft,
				published: false,
				food: null,
				foodItem: null,
				foodGuessed: false,
			}),
		]);
	});

	it("includes the company name", async () => {
		const { t, companyId, admin } = await fixture();
		await insertEvent(t, companyId, { eventStart: springEvent });

		const events = await admin.query(api.events.food.eventsForFoodTagging, {
			semester: "vår",
			year: 2027,
		});
		expect(events).toEqual([expect.objectContaining({ companyName: "Testbedrift" })]);
	});
});

describe("bulkAssignFoodItem", () => {
	it("refuses callers below admin", async () => {
		const { t, companyId, editor } = await fixture();
		const eventId = await insertEvent(t, companyId);
		const foodItem = await insertFoodItem(t);
		await expect(
			refusalMessageFrom(
				editor.mutation(api.events.food.bulkAssignFoodItem, {
					eventIds: [eventId],
					foodItem,
				}),
			),
		).resolves.toContain("Unauthorized");
	});

	it("refuses an empty selection and one above the cap", async () => {
		const { t, companyId, admin } = await fixture();
		const eventId = await insertEvent(t, companyId);
		const foodItem = await insertFoodItem(t);
		await expect(
			refusalMessageFrom(
				admin.mutation(api.events.food.bulkAssignFoodItem, { eventIds: [], foodItem }),
			),
		).resolves.toContain("Velg mellom 1 og 200");
		await expect(
			refusalMessageFrom(
				admin.mutation(api.events.food.bulkAssignFoodItem, {
					eventIds: Array.from({ length: 201 }, () => eventId),
					foodItem,
				}),
			),
		).resolves.toContain("Velg mellom 1 og 200");
	});

	it("refuses a missing event", async () => {
		const { t, companyId, admin } = await fixture();
		const eventId = await insertEvent(t, companyId);
		const foodItem = await insertFoodItem(t);
		await t.run((ctx) => ctx.db.delete(eventId));
		await expect(
			refusalMessageFrom(
				admin.mutation(api.events.food.bulkAssignFoodItem, { eventIds: [eventId], foodItem }),
			),
		).resolves.toContain("ble ikke funnet");
	});

	it("refuses a missing food item", async () => {
		const { t, companyId, admin } = await fixture();
		const eventId = await insertEvent(t, companyId);
		const foodItem = await insertFoodItem(t);
		await t.run((ctx) => ctx.db.delete(foodItem));
		await expect(
			refusalMessageFrom(
				admin.mutation(api.events.food.bulkAssignFoodItem, { eventIds: [eventId], foodItem }),
			),
		).resolves.toContain("Fant ikke matvalget");
	});

	it("sets the food item and clears the guess", async () => {
		const { t, companyId, admin } = await fixture();
		const cake = await insertFoodItem(t, "cake");
		const burritos = await insertFoodItem(t, "burritos");
		const first = await insertEvent(t, companyId, { foodItem: cake, foodGuessed: true });
		const second = await insertEvent(t, companyId, { food: "Middag" });

		const count = await admin.mutation(api.events.food.bulkAssignFoodItem, {
			eventIds: [first, second],
			foodItem: burritos,
		});

		expect(count).toBe(2);
		for (const id of [first, second]) {
			const event = await t.run((ctx) => ctx.db.get(id));
			expect(event?.foodItem).toBe(burritos);
			expect(event?.foodGuessed).toBeUndefined();
		}
	});
});

describe("nameKey", () => {
	it.each([
		["🥪 Bánh mì", "banhmi"],
		["  Banh-Mi ", "banhmi"],
		["Kaffe og kake", "kaffeogkake"],
		["Smørbrød", "smørbrød"],
		["🍕", ""],
	])("keys %j as %j", (name, key) => {
		expect(nameKey(name)).toBe(key);
	});
});

describe("createFoodItem", () => {
	it("lets every internal member create an item and refuses students", async () => {
		const { t, editor } = await fixture();
		const student = asUser(t, await insertUser(t, "student@example.test"));

		const created = await editor.mutation(api.events.food.createFoodItem, { name: "Middag" });
		expect(await t.run((ctx) => ctx.db.get(created))).toMatchObject({ name: "Middag" });
		await expect(
			refusalMessageFrom(student.mutation(api.events.food.createFoodItem, { name: "Lunsj" })),
		).resolves.toBeTruthy();
	});

	it("trims the name and reuses an item with the same key", async () => {
		const { t, admin } = await fixture();
		const banhMi = await insertFoodItem(t, "banh_mi");

		const created = await admin.mutation(api.events.food.createFoodItem, {
			name: "  Middag   fra  kantina ",
		});
		const again = await admin.mutation(api.events.food.createFoodItem, {
			name: "middag fra kantina",
		});
		const reused = await admin.mutation(api.events.food.createFoodItem, { name: "banh mi" });

		expect(again).toBe(created);
		expect(reused).toBe(banhMi);
		expect(await t.run((ctx) => ctx.db.get(created))).toMatchObject({
			name: "Middag fra kantina",
			nameKey: "middagfrakantina",
		});
	});

	it("refuses an empty name and one that is too long", async () => {
		const { admin } = await fixture();
		await expect(
			refusalMessageFrom(admin.mutation(api.events.food.createFoodItem, { name: " 🍕 " })),
		).resolves.toContain("må ha et navn");
		await expect(
			refusalMessageFrom(admin.mutation(api.events.food.createFoodItem, { name: "a".repeat(41) })),
		).resolves.toContain("maks 40 tegn");
	});
});

describe("listFoodItems", () => {
	it("lists items sorted by name for internal members", async () => {
		const { t, editor } = await fixture();
		await insertFoodItem(t, "sushi");
		await t.run((ctx) => ctx.db.insert("foodItems", { name: "Annet", nameKey: "annet" }));

		const items = await editor.query(api.events.food.listFoodItems, {});
		expect(items.map(({ name }) => name)).toEqual(["Annet", "🍣 Sushi"]);
	});

	it("refuses students", async () => {
		const { t } = await setup();
		const student = asUser(t, await insertUser(t, "student@example.test"));
		expect(await refusalMessageFrom(student.query(api.events.food.listFoodItems, {}))).toBeTruthy();
	});
});
