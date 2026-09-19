import { describe, expect, test } from "vitest";
import { internal } from "../../_generated/api";
import { createHarness, seedEvent, seedRegistration } from "../../test.setup";

const ONE_HOUR_MS = 60 * 60 * 1000;

describe("checkPendingRegistrations", () => {
	test("moves an expired offer to the back of the queue and offers the seat on", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const stale = await seedRegistration(t, eventId, "pending", Date.now() - 17 * ONE_HOUR_MS);
		const next = await seedRegistration(t, eventId, "waitlist", Date.now() - 2 * ONE_HOUR_MS);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		const staleRow = await t.run(async (ctx) => await ctx.db.get(stale.registrationId));
		const nextRow = await t.run(async (ctx) => await ctx.db.get(next.registrationId));
		expect(staleRow?.status).toBe("waitlist");
		expect(nextRow?.status).toBe("pending");
	});

	test("leaves an offer alone before the response window closes", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const fresh = await seedRegistration(t, eventId, "pending", Date.now() - 15 * ONE_HOUR_MS);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		const row = await t.run(async (ctx) => await ctx.db.get(fresh.registrationId));
		expect(row?.status).toBe("pending");
	});

	test("fills seats that went free without any offer expiring", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 3);
		const first = await seedRegistration(t, eventId, "waitlist", Date.now() - 2 * ONE_HOUR_MS);
		const second = await seedRegistration(t, eventId, "waitlist", Date.now() - ONE_HOUR_MS);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		const rows = await t.run(async (ctx) => [
			await ctx.db.get(first.registrationId),
			await ctx.db.get(second.registrationId),
		]);
		expect(rows.map((row) => row?.status)).toEqual(["pending", "pending"]);
	});

	test("does not send a checked in attendee back to the queue", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const attendee = await seedRegistration(t, eventId, "pending", Date.now() - 17 * ONE_HOUR_MS);
		await t.run(async (ctx) => {
			await ctx.db.patch(attendee.registrationId, { attendanceStatus: "confirmed" });
		});

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		const row = await t.run(async (ctx) => await ctx.db.get(attendee.registrationId));
		expect(row?.status).toBe("pending");
	});
});

describe("offerFreeSeats", () => {
	test("never hands out more seats than the event has", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		await seedRegistration(t, eventId, "registered", Date.now() - 4 * ONE_HOUR_MS);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 3 * ONE_HOUR_MS);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 2 * ONE_HOUR_MS);

		await t.mutation(internal.events.mutations.updateWaitlistMutation, { eventId });

		const rows = await t.run(
			async (ctx) =>
				await ctx.db
					.query("registrations")
					.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
					.collect(),
		);
		const occupied = rows.filter((row) => row.status !== "waitlist").length;
		expect(occupied).toBe(2);
	});

	test("clears a queue entry whose user no longer exists", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const orphan = await seedRegistration(t, eventId, "waitlist", Date.now() - ONE_HOUR_MS);
		await t.run(async (ctx) => {
			await ctx.db.delete(orphan.userId);
		});

		await t.mutation(internal.events.mutations.updateWaitlistMutation, { eventId });

		expect(await t.run(async (ctx) => await ctx.db.get(orphan.registrationId))).toBeNull();
	});
});

describe("seat allocation has a single entry point", () => {
	const sources = import.meta.glob("../../**/*.ts", {
		query: "?raw",
		import: "default",
		eager: true,
	}) as Record<string, string>;

	test("no module outside seats.ts moves a registration into pending", () => {
		const offenders = Object.entries(sources)
			.filter(([file]) => !file.includes("seats.ts") && !file.includes(".test.ts"))
			.filter(([, text]) => /status:\s*"pending"/.test(text))
			.map(([file]) => file);

		expect(offenders).toEqual([]);
	});
});
