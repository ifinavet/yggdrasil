/// <reference types="vite/client" />
import { REGISTRATION_GRACE_PERIOD_MS } from "@workspace/shared/constants";
import { describe, expect, it } from "vitest";
import {
	asUser,
	insertEvent,
	insertRegistration,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../test/fixtures";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

async function statusOf(t: TestBackend, registrationId: Id<"registrations">) {
	return t.run(async (ctx) => (await ctx.db.get(registrationId))?.status ?? null);
}

async function statusesFor(t: TestBackend, eventId: Id<"events">) {
	return t.run(async (ctx) => {
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect();
		return registrations.map((registration) => registration.status).sort();
	});
}

describe("REGISTRATION_GRACE_PERIOD_MS", () => {
	it("is thirty minutes", () => {
		expect(REGISTRATION_GRACE_PERIOD_MS).toBe(30 * 60 * 1000);
	});
});

describe("register honours the registration window", () => {
	it("refuses before registration opens", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: Date.now() + HOUR_IN_MS,
		});
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(api.events.registrations.mutations.register, { eventId }),
		);

		expect(message).toContain("har ikke åpnet ennå");
		expect(await statusesFor(t, eventId)).toEqual([]);
	});

	it("still registers inside the grace period after the event has started", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: Date.now() - REGISTRATION_GRACE_PERIOD_MS / 2,
		});
		const student = await insertUser(t, "student@example.com");

		const status = await asUser(t, student).mutation(
			api.events.registrations.mutations.register,
			{ eventId },
		);

		expect(status).toBe("registered");
	});

	it("refuses once the grace period has passed", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: Date.now() - REGISTRATION_GRACE_PERIOD_MS - MINUTE_IN_MS,
		});
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(api.events.registrations.mutations.register, { eventId }),
		);

		expect(message).toContain("er stengt");
		expect(await statusesFor(t, eventId)).toEqual([]);
	});
});

describe("acceptPendingRegistration honours the same grace period", () => {
	it("accepts an offered seat inside the grace period", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: Date.now() - REGISTRATION_GRACE_PERIOD_MS / 2,
		});
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");

		await asUser(t, owner).mutation(
			api.events.registrations.mutations.acceptPendingRegistration,
			{ id: registrationId },
		);

		expect(await statusOf(t, registrationId)).toBe("registered");
	});

	it("refuses an offered seat once the grace period has passed", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: Date.now() - REGISTRATION_GRACE_PERIOD_MS - MINUTE_IN_MS,
		});
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");

		const message = await refusalMessageFrom(
			asUser(t, owner).mutation(
				api.events.registrations.mutations.acceptPendingRegistration,
				{ id: registrationId },
			),
		);

		expect(message).toContain("er stengt");
		expect(await statusOf(t, registrationId)).toBe("pending");
	});
});

describe("register respects the participation limit", () => {
	it("registers the first caller and waitlists the second", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const first = await insertUser(t, "forst@example.com");
		const second = await insertUser(t, "andre@example.com");

		const firstStatus = await asUser(t, first).mutation(
			api.events.registrations.mutations.register,
			{ eventId },
		);
		const secondStatus = await asUser(t, second).mutation(
			api.events.registrations.mutations.register,
			{ eventId },
		);

		expect(firstStatus).toBe("registered");
		expect(secondStatus).toBe("waitlist");
		expect(await statusesFor(t, eventId)).toEqual(["registered", "waitlist"]);
	});

	it("counts an outstanding pending offer against the seat limit", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const offered = await insertUser(t, "tilbudt@example.com");
		await insertRegistration(t, eventId, offered._id, "pending");
		const latecomer = await insertUser(t, "sent@example.com");

		const status = await asUser(t, latecomer).mutation(
			api.events.registrations.mutations.register,
			{ eventId },
		);

		expect(status).toBe("waitlist");
	});
});
