import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	HOUR_IN_MS,
	insertEvent,
	insertFoodItem,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { registrationPhaseAt, scheduleRegistrationPhase } from "./helper";

afterEach(() => vi.useRealTimers());

async function fixture() {
	vi.useFakeTimers();
	const { t, companyId } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	return { t, companyId, client: asUser(t, admin), foodItem: await insertFoodItem(t) };
}

async function eventOf(t: TestBackend, eventId: Id<"events">) {
	const event = await t.run((ctx) => ctx.db.get(eventId));
	if (!event) throw new Error("Expected the event.");
	return event;
}

async function phaseJobs(t: TestBackend, eventId: Id<"events">) {
	const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
	return scheduled
		.filter(
			({ name, args, state }) =>
				name.includes("syncRegistrationPhase") &&
				args[0].eventId === eventId &&
				state.kind === "pending",
		)
		.map(({ scheduledTime, args }) => ({ scheduledTime, args: args[0] }))
		.sort((a, b) => a.scheduledTime - b.scheduledTime);
}

/** Inserts an event and stores its phase, as creating it does. */
async function insertScheduled(
	t: TestBackend,
	companyId: Id<"companies">,
	overrides: Partial<Doc<"events">> = {},
) {
	const eventId = await insertEvent(t, companyId, overrides);
	await t.run((ctx) => scheduleRegistrationPhase(ctx, eventId));
	return eventId;
}

/** Runs the jobs that are due once the clock reaches the given time. */
async function runDueJobs(t: TestBackend, time: number) {
	vi.advanceTimersByTime(time - Date.now());
	await t.finishInProgressScheduledFunctions();
}

function createArgs(event: Doc<"events">, foodItem: Id<"foodItems">) {
	return {
		title: event.title,
		teaser: event.teaser,
		description: event.description,
		eventStart: event.eventStart,
		registrationOpens: event.registrationOpens,
		participationLimit: event.participationLimit,
		location: event.location,
		foodItem,
		language: event.language,
		ageRestriction: event.ageRestriction,
		externalEvent: event.externalEvent,
		hostingCompany: event.hostingCompany,
		published: event.published,
		organizers: [],
	};
}

function updateArgs(event: Doc<"events">, foodItem: Id<"foodItems">) {
	return { id: event._id, ...createArgs(event, foodItem) };
}

describe("registrationPhaseAt", () => {
	it("is upcoming before opening, open until the start and closed from the start", () => {
		const event = { registrationOpens: 100, eventStart: 200 };
		expect(registrationPhaseAt(event, 99)).toBe("upcoming");
		expect(registrationPhaseAt(event, 100)).toBe("open");
		expect(registrationPhaseAt(event, 199)).toBe("open");
		expect(registrationPhaseAt(event, 200)).toBe("closed");
	});
});

describe("registration phase jobs", () => {
	it("stores the phase on creation and moves it on at each boundary", async () => {
		const { t, companyId, client, foodItem } = await fixture();
		const registrationOpens = Date.now() + HOUR_IN_MS;
		const eventStart = registrationOpens + DAY_IN_MS;
		await client.mutation(api.events.mutations.create, {
			...createArgs(await eventOf(t, await insertEvent(t, companyId)), foodItem),
			title: "Fjordkode",
			registrationOpens,
			eventStart,
		});
		const created = await t.run((ctx) =>
			ctx.db
				.query("events")
				.filter((q) => q.eq(q.field("title"), "Fjordkode"))
				.first(),
		);
		const eventId = created?._id as Id<"events">;

		expect(created?.registrationPhase).toBe("upcoming");
		expect(await phaseJobs(t, eventId)).toEqual([
			{ scheduledTime: registrationOpens, args: { eventId, registrationOpens, eventStart } },
			{ scheduledTime: eventStart, args: { eventId, registrationOpens, eventStart } },
		]);
	});

	it("is open after the opening job and closed after the start job", async () => {
		const { t, companyId } = await fixture();
		const registrationOpens = Date.now() + HOUR_IN_MS;
		const eventStart = registrationOpens + DAY_IN_MS;
		const eventId = await insertScheduled(t, companyId, { registrationOpens, eventStart });
		expect((await eventOf(t, eventId)).registrationPhase).toBe("upcoming");

		await runDueJobs(t, registrationOpens);
		expect((await eventOf(t, eventId)).registrationPhase).toBe("open");

		await runDueJobs(t, eventStart);
		expect((await eventOf(t, eventId)).registrationPhase).toBe("closed");
		expect(await phaseJobs(t, eventId)).toEqual([]);
	});

	it("follows a moved start, and the job for the old start does nothing", async () => {
		const { t, companyId, client, foodItem } = await fixture();
		const registrationOpens = Date.now() - HOUR_IN_MS;
		const oldStart = Date.now() + DAY_IN_MS;
		const newStart = oldStart + DAY_IN_MS;
		const eventId = await insertScheduled(t, companyId, {
			registrationOpens,
			eventStart: oldStart,
		});
		expect((await eventOf(t, eventId)).registrationPhase).toBe("open");

		await client.mutation(api.events.mutations.update, {
			...updateArgs(await eventOf(t, eventId), foodItem),
			eventStart: newStart,
		});
		expect((await phaseJobs(t, eventId)).map(({ scheduledTime }) => scheduledTime)).toEqual([
			oldStart,
			newStart,
		]);

		await runDueJobs(t, oldStart);
		expect((await eventOf(t, eventId)).registrationPhase).toBe("open");

		await runDueJobs(t, newStart);
		expect((await eventOf(t, eventId)).registrationPhase).toBe("closed");
	});

	it("reschedules nothing when an update leaves the times and publishing alone", async () => {
		const { t, companyId, client, foodItem } = await fixture();
		const eventId = await insertScheduled(t, companyId);
		const before = await phaseJobs(t, eventId);

		await client.mutation(api.events.mutations.update, {
			...updateArgs(await eventOf(t, eventId), foodItem),
			title: "Ny tittel",
		});

		expect(await phaseJobs(t, eventId)).toEqual(before);
	});

	it("does nothing when a job's times no longer match the event", async () => {
		const { t, companyId } = await fixture();
		const event = await eventOf(t, await insertScheduled(t, companyId));
		await t.run((ctx) => ctx.db.patch(event._id, { registrationPhase: "upcoming" }));

		for (const stale of [
			{ registrationOpens: event.registrationOpens - 1, eventStart: event.eventStart },
			{ registrationOpens: event.registrationOpens, eventStart: event.eventStart - 1 },
		]) {
			await t.mutation(internal.events.mutations.syncRegistrationPhase, {
				eventId: event._id,
				...stale,
			});
		}

		expect((await eventOf(t, event._id)).registrationPhase).toBe("upcoming");
	});

	it("does nothing for a deleted event", async () => {
		const { t, companyId } = await fixture();
		const event = await eventOf(t, await insertEvent(t, companyId));
		await t.run((ctx) => ctx.db.delete(event._id));

		await t.run((ctx) => scheduleRegistrationPhase(ctx, event._id));
		await t.mutation(internal.events.mutations.syncRegistrationPhase, {
			eventId: event._id,
			registrationOpens: event.registrationOpens,
			eventStart: event.eventStart,
		});

		expect(await phaseJobs(t, event._id)).toEqual([]);
	});

	it("leaves a phase that is already right as it is", async () => {
		const { t, companyId } = await fixture();
		const event = await eventOf(t, await insertScheduled(t, companyId));
		expect(event.registrationPhase).toBe("open");

		await t.mutation(internal.events.mutations.syncRegistrationPhase, {
			eventId: event._id,
			registrationOpens: event.registrationOpens,
			eventStart: event.eventStart,
		});

		expect(await eventOf(t, event._id)).toEqual(event);
	});

	it("schedules only the boundaries that are still ahead", async () => {
		const { t, companyId } = await fixture();
		const now = Date.now();
		const finished = await insertScheduled(t, companyId, {
			registrationOpens: now - 2 * DAY_IN_MS,
			eventStart: now - DAY_IN_MS,
		});
		const startsNow = await insertScheduled(t, companyId, {
			registrationOpens: now - DAY_IN_MS,
			eventStart: now,
		});
		const open = await insertScheduled(t, companyId, {
			registrationOpens: now - DAY_IN_MS,
			eventStart: now + DAY_IN_MS,
		});

		for (const eventId of [finished, startsNow]) {
			expect((await eventOf(t, eventId)).registrationPhase).toBe("closed");
			expect(await phaseJobs(t, eventId)).toEqual([]);
		}
		expect((await eventOf(t, open)).registrationPhase).toBe("open");
		expect((await phaseJobs(t, open)).map(({ scheduledTime }) => scheduledTime)).toEqual([
			now + DAY_IN_MS,
		]);
	});

	it("schedules one job when registration opens as the event starts", async () => {
		const { t, companyId } = await fixture();
		const eventStart = Date.now() + DAY_IN_MS;
		const eventId = await insertScheduled(t, companyId, {
			registrationOpens: eventStart,
			eventStart,
		});

		expect((await phaseJobs(t, eventId)).map(({ scheduledTime }) => scheduledTime)).toEqual([
			eventStart,
		]);
	});

	it("gives unpublished and external events a phase too", async () => {
		const { t, companyId, client, foodItem } = await fixture();
		const base = createArgs(await eventOf(t, await insertEvent(t, companyId)), foodItem);
		const registrationOpens = Date.now() + HOUR_IN_MS;
		const eventStart = Date.now() + DAY_IN_MS;
		for (const [title, options] of [
			["Utkast", { published: false }],
			["Eksternt", { externalEvent: true }],
		] as const) {
			await client.mutation(api.events.mutations.create, {
				...base,
				title,
				registrationOpens,
				eventStart,
				...options,
			});
		}

		const events = await t.run((ctx) => ctx.db.query("events").collect());
		for (const title of ["Utkast", "Eksternt"]) {
			const event = events.find((candidate) => candidate.title === title);
			expect(event?.registrationPhase).toBe("upcoming");
			expect(
				(await phaseJobs(t, event?._id as Id<"events">)).map(({ scheduledTime }) => scheduledTime),
			).toEqual([registrationOpens, eventStart]);
		}
	});

	it("keeps the phase and its jobs when only publishing changes", async () => {
		const { t, companyId, client, foodItem } = await fixture();
		const registrationOpens = Date.now() + HOUR_IN_MS;
		const eventId = await insertScheduled(t, companyId, { registrationOpens, published: false });
		const jobs = await phaseJobs(t, eventId);

		await client.mutation(api.events.mutations.updatePublishedStatus, {
			ids: [eventId],
			newPublishedStatus: true,
		});
		await client.mutation(api.events.mutations.update, {
			...updateArgs(await eventOf(t, eventId), foodItem),
			externalEvent: true,
			published: false,
		});
		expect(await phaseJobs(t, eventId)).toEqual(jobs);
		expect((await eventOf(t, eventId)).registrationPhase).toBe("upcoming");

		await runDueJobs(t, registrationOpens);
		expect((await eventOf(t, eventId)).registrationPhase).toBe("open");
	});
});
