import { describe, expect, it, vi } from "vitest";
import {
	asUser,
	emailsWithStatus,
	grantRole,
	insertEvent,
	insertFoodItem,
	insertRegistration,
	insertUser,
	scheduledRecipientsOf,
	setup,
	statusOf,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

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
	const foodItem = await insertFoodItem(t);
	return { t, companyId, foodItem, client: asUser(t, user) };
}

const eventArgs = {
	title: "Testarrangement",
	teaser: "",
	description: "",
	eventStart: Date.now() + 86_400_000,
	registrationOpens: Date.now(),
	participationLimit: 10,
	location: "Ole-Johan Dahls hus",
	language: "norsk",
	ageRestriction: "",
	externalEvent: false,
	hostingCompany: undefined as unknown as string,
	published: true,
	organizers: [],
};

async function createEventAndFind() {
	const { t, companyId, foodItem, client } = await fixture();
	await client.mutation(api.events.mutations.create, {
		...eventArgs,
		foodItem,
		hostingCompany: companyId,
	});
	const event = await t.run((ctx) =>
		ctx.db
			.query("events")
			.filter((q) => q.eq(q.field("title"), eventArgs.title))
			.first(),
	);
	return { t, client, eventId: event?._id as Id<"events"> };
}

async function remindersEnabled(
	client: Awaited<ReturnType<typeof fixture>>["client"],
	eventId: Id<"events">,
) {
	const settings = await client.query(api.events.reminders.queries.getEventReminders, { eventId });
	return settings.enabled;
}

describe("registration opening alerts", () => {
	it("waits for the current opening time and sends once after rescheduling", async () => {
		vi.useFakeTimers();
		const { t, companyId, foodItem, client } = await fixture();
		const firstOpening = Date.now() + 60_000;
		const eventStart = firstOpening + 86_400_000;
		await client.mutation(api.events.mutations.create, {
			...eventArgs,
			title: "Fjordkode bedpres",
			eventStart,
			registrationOpens: firstOpening,
			foodItem,
			hostingCompany: companyId,
		});
		const event = await t.run((ctx) => ctx.db.query("events").withIndex("by_eventStart").first());
		if (!event) throw new Error("Event was not created");

		await t.mutation(internal.events.mutations.sendRegistrationOpenAlert, {
			eventId: event._id,
			registrationOpens: firstOpening,
		});
		expect(await t.run((ctx) => ctx.db.query("eventRegistrationOpenNotices").collect())).toEqual(
			[],
		);

		const secondOpening = firstOpening + 60_000;
		await client.mutation(api.events.mutations.update, {
			...eventArgs,
			id: event._id,
			title: "Fjordkode bedpres",
			eventStart: secondOpening + 86_400_000,
			registrationOpens: secondOpening,
			foodItem,
			hostingCompany: companyId,
		});
		vi.setSystemTime(secondOpening + 1);

		await t.mutation(internal.events.mutations.sendRegistrationOpenAlert, {
			eventId: event._id,
			registrationOpens: firstOpening,
		});
		await t.mutation(internal.events.mutations.sendRegistrationOpenAlert, {
			eventId: event._id,
			registrationOpens: secondOpening,
		});
		await t.mutation(internal.events.mutations.sendRegistrationOpenAlert, {
			eventId: event._id,
			registrationOpens: secondOpening,
		});

		const notices = await t.run((ctx) => ctx.db.query("eventRegistrationOpenNotices").collect());
		expect(notices).toMatchObject([{ eventId: event._id, registrationOpens: secondOpening }]);
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		const alerts = scheduled.filter(({ name }) => name.includes("notifications:sendMessage"));
		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.args[0]).toMatchObject({
			channel: "C0C5L3JPSE7",
			text: expect.stringContaining("🔔 *Påmeldingen har åpnet*"),
		});
		expect(alerts[0]?.args[0].text).toContain("Fjordkode bedpres");
		vi.useRealTimers();
	});

	it("does not queue notices for drafts, external or finished events", async () => {
		const { t, companyId, foodItem, client } = await fixture();
		const now = Date.now();
		for (const [title, options] of [
			["Draft", { published: false }],
			["External", { externalEvent: true }],
			["Finished", { eventStart: now - 1, registrationOpens: now - 86_400_000 }],
		] as const) {
			await client.mutation(api.events.mutations.create, {
				...eventArgs,
				title,
				eventStart: now + 86_400_000,
				registrationOpens: now + 60_000,
				foodItem,
				hostingCompany: companyId,
				...options,
			});
		}
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled.filter(({ name }) => name.includes("sendRegistrationOpenAlert"))).toHaveLength(
			0,
		);
	});
});

describe("events.mutations.create", () => {
	it("snapshots the chosen product", async () => {
		const { t, companyId, foodItem, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));

		await client.mutation(api.events.mutations.create, {
			...eventArgs,
			foodItem,
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
			vatRate: eventProduct.vatRate,
		});
	});

	it("turns reminder and feedback emails on for a new event", async () => {
		const { t, client, eventId } = await createEventAndFind();

		expect(await t.run((ctx) => ctx.db.get(eventId))).toMatchObject({
			remindersEnabled: true,
			feedbackEnabled: true,
		});
		expect(await remindersEnabled(client, eventId)).toBe(true);
	});

	it("lets the board opt out of reminders on a new event", async () => {
		const { client, eventId } = await createEventAndFind();

		await client.mutation(api.events.reminders.mutations.setEventReminders, {
			eventId,
			enabled: false,
		});

		expect(await remindersEnabled(client, eventId)).toBe(false);
	});

	it("leaves existing events without the flags switched off", async () => {
		const { t, companyId, client } = await fixture();
		const eventId = await insertEvent(t, companyId);
		await t.run((ctx) =>
			ctx.db.patch(eventId, { remindersEnabled: undefined, feedbackEnabled: undefined }),
		);

		expect(await remindersEnabled(client, eventId)).toBe(false);
	});
});

describe("events.mutations.update", () => {
	it("snapshots a newly chosen product", async () => {
		const { t, companyId, foodItem, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const eventId = await insertEvent(t, companyId);

		await client.mutation(api.events.mutations.update, {
			...eventArgs,
			foodItem,
			id: eventId,
			hostingCompany: companyId,
			productId,
		});

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.product).toEqual({
			productId,
			name: eventProduct.name,
			unitPriceOre: eventProduct.unitPriceOre,
			vatRate: eventProduct.vatRate,
		});
	});

	it("keeps the existing snapshot when the same product is chosen again", async () => {
		const { t, companyId, foodItem, client } = await fixture();
		const productId = await t.run((ctx) => ctx.db.insert("products", eventProduct));
		const eventId = await insertEvent(t, companyId, {
			product: { productId, name: eventProduct.name, unitPriceOre: eventProduct.unitPriceOre },
			productGuessed: true,
		});

		await client.mutation(api.events.mutations.update, {
			...eventArgs,
			foodItem,
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

describe("event food", () => {
	it("stores the chosen food item on create", async () => {
		const { t, companyId, client } = await fixture();
		const burritos = await insertFoodItem(t, "burritos");

		await client.mutation(api.events.mutations.create, {
			...eventArgs,
			foodItem: burritos,
			hostingCompany: companyId,
		});

		const event = await t.run((ctx) =>
			ctx.db
				.query("events")
				.filter((q) => q.eq(q.field("title"), eventArgs.title))
				.first(),
		);
		expect(event?.foodItem).toBe(burritos);
	});

	it("confirms a guessed food item on update and keeps the legacy text", async () => {
		const { t, companyId, client } = await fixture();
		const sushi = await insertFoodItem(t, "sushi");
		const eventId = await insertEvent(t, companyId, {
			food: "Sushi fra Sticks",
			foodItem: sushi,
			foodGuessed: true,
		});

		await client.mutation(api.events.mutations.update, {
			...eventArgs,
			foodItem: sushi,
			id: eventId,
			hostingCompany: companyId,
		});

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.foodItem).toBe(sushi);
		expect(event?.foodGuessed).toBeUndefined();
		expect(event?.food).toBe("Sushi fra Sticks");
	});
});

describe("registration opening catch-up", () => {
	it("notifies both channels for an existing event with no opening job and deduplicates subsequent runs", async () => {
		vi.useFakeTimers();
		vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
		try {
			const { t, companyId } = await setup();
			const now = Date.now();
			const registrationOpens = now - 60 * 60 * 1000;
			const eventId = await insertEvent(t, companyId, {
				title: "Intility",
				registrationOpens,
				eventStart: now + 14 * 86_400_000,
				published: true,
			});
			await t.mutation(eventMutations.catchUpRegistrationOpenAlerts, {});
			await t.mutation(eventMutations.catchUpRegistrationOpenAlerts, {});
			await t.mutation(eventMutations.sendRegistrationOpenAlert, { eventId, registrationOpens });
			const notices = await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect());
			expect(notices).toMatchObject([{ eventId, key: `registration-open:${registrationOpens}` }]);
			expect(notices).toHaveLength(1);
			const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
			const system = scheduled.filter(({ name }) => name.includes("notifications:sendMessage"));
			expect(system).toHaveLength(1);
			expect(system[0]?.args[0]).toMatchObject({
				channel: "C0C5L3JPSE7",
				text: expect.stringContaining("Intility"),
			});
		} finally {
			vi.unstubAllEnvs();
			vi.useRealTimers();
		}
	});

	it("skips future openings, drafts, external and finished events", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		for (const overrides of [
			{ registrationOpens: now + 60_000 },
			{ published: false },
			{ externalEvent: true },
			{ eventStart: now - 1 },
		]) {
			await insertEvent(t, companyId, {
				registrationOpens: now - 60_000,
				eventStart: now + 86_400_000,
				published: true,
				...overrides,
			});
		}
		await t.mutation(eventMutations.catchUpRegistrationOpenAlerts, {});
		expect(await t.run((ctx) => ctx.db.query("eventRegistrationOpenNotices").collect())).toEqual(
			[],
		);
	});
});

it("recovers openings older than a day across all pages without claiming delivery", async () => {
	const { t, companyId } = await setup();
	const now = Date.now();
	for await (const index of Array.from({ length: 51 }, (_, index) => index)) {
		await insertEvent(t, companyId, {
			title: `Existing ${index}`,
			eventStart: now + 7 * 86_400_000,
			registrationOpens: now - 3 * 86_400_000,
		});
	}
	await t.mutation(eventMutations.catchUpRegistrationOpenAlerts, {});
	const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
	const continuation = scheduled.find(({ name }) => name.includes("catchUpRegistrationOpenAlerts"));
	expect(continuation).toBeDefined();
	await t.mutation(eventMutations.catchUpRegistrationOpenAlerts, continuation?.args[0]);
	const notices = await t.run((ctx) => ctx.db.query("eventRegistrationOpenNotices").collect());
	expect(notices).toHaveLength(51);
	expect(notices.every((notice) => notice.sentAt === undefined)).toBe(true);
	expect(await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect())).toHaveLength(51);
});
