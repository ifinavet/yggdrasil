import { guessFoodItem } from "@workspace/shared/events/food";
import { describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

async function fixture() {
	const { t, companyId } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const editor = await insertUser(t, "editor@example.test");
	await grantRole(t, editor._id, "editor");
	return { t, companyId, admin: asUser(t, admin), editor: asUser(t, editor) };
}

const springEvent = new Date("2027-02-10T10:00:00Z").getTime();

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

		expect(await food(t, matched)).toMatchObject({ foodItem: "pizza", foodGuessed: true });
		const left = await food(t, unmatched);
		expect(left?.foodItem).toBeUndefined();
		expect(left?.foodGuessed).toBeUndefined();
	});

	it("skips events that already have a food item", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { food: "Pizza", foodItem: "sushi" });

		await migrate(t);

		const event = await food(t, eventId);
		expect(event?.foodItem).toBe("sushi");
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

		expect(await t.run((ctx) => ctx.db.get(eventId))).toMatchObject({
			foodItem: "sushi",
			foodGuessed: true,
		});
		expect(await editor.query(api.events.food.backfillPending, {})).toBe(false);

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
		const guessed = await insertEvent(t, companyId, {
			eventStart: springEvent,
			food: "Sushi",
			foodItem: "sushi",
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
				foodItem: "sushi",
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
		await expect(
			refusalMessageFrom(
				editor.mutation(api.events.food.bulkAssignFoodItem, {
					eventIds: [eventId],
					foodItem: "pizza",
				}),
			),
		).resolves.toContain("Unauthorized");
	});

	it("refuses an empty selection and one above the cap", async () => {
		const { t, companyId, admin } = await fixture();
		const eventId = await insertEvent(t, companyId);
		await expect(
			refusalMessageFrom(
				admin.mutation(api.events.food.bulkAssignFoodItem, { eventIds: [], foodItem: "pizza" }),
			),
		).resolves.toContain("Velg mellom 1 og 200");
		await expect(
			refusalMessageFrom(
				admin.mutation(api.events.food.bulkAssignFoodItem, {
					eventIds: Array.from({ length: 201 }, () => eventId),
					foodItem: "pizza",
				}),
			),
		).resolves.toContain("Velg mellom 1 og 200");
	});

	it("refuses a missing event", async () => {
		const { t, companyId, admin } = await fixture();
		const eventId = await insertEvent(t, companyId);
		await t.run((ctx) => ctx.db.delete(eventId));
		await expect(
			refusalMessageFrom(
				admin.mutation(api.events.food.bulkAssignFoodItem, {
					eventIds: [eventId],
					foodItem: "pizza",
				}),
			),
		).resolves.toContain("ble ikke funnet");
	});

	it("sets the food item and clears the guess", async () => {
		const { t, companyId, admin } = await fixture();
		const first = await insertEvent(t, companyId, { foodItem: "cake", foodGuessed: true });
		const second = await insertEvent(t, companyId, { food: "Middag" });

		const count = await admin.mutation(api.events.food.bulkAssignFoodItem, {
			eventIds: [first, second],
			foodItem: "burritos",
		});

		expect(count).toBe(2);
		for (const id of [first, second]) {
			const event = await t.run((ctx) => ctx.db.get(id));
			expect(event?.foodItem).toBe("burritos");
			expect(event?.foodGuessed).toBeUndefined();
		}
	});
});
