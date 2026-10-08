import { describe, expect, it } from "vitest";
import {
	asUser,
	HOUR_IN_MS,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertStudent,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { computeEventStats } from "./stats";

const registrationMutations = api.events.registrations.mutations;
const waitlistMutations = internal.events.waitlist.mutations;

async function expectStatsMatchRaw(t: TestBackend, eventId: Id<"events">) {
	const { stored, recomputed, rows } = await t.run(async (ctx) => {
		const event = (await ctx.db.get(eventId)) as Doc<"events">;
		return {
			stored: await ctx.db
				.query("eventStats")
				.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
				.collect(),
			recomputed: await computeEventStats(ctx, event),
			rows: await ctx.db
				.query("registrations")
				.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
				.collect(),
		};
	});
	expect(stored).toHaveLength(1);
	const { _id, _creationTime, ...row } = stored[0] as Doc<"eventStats">;
	expect(row).toEqual(recomputed);
	const registered = rows.filter((registration) => registration.status === "registered");
	expect(row.registered).toBe(registered.length);
	expect(row.waitlist).toBe(
		rows.filter((registration) => registration.status === "waitlist").length,
	);
	expect(row.pending).toBe(rows.filter((registration) => registration.status === "pending").length);
	expect([...row.registrants].sort()).toEqual(
		registered.map((registration) => registration.userId).sort(),
	);
	return row;
}

describe("eventStats write-through", () => {
	it("tracks registrations and waitlisting", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const first = await insertUser(t, "forst@example.com");
		const second = await insertUser(t, "andre@example.com");

		await asUser(t, first).mutation(registrationMutations.register, { eventId });
		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({
			registered: 1,
			waitlist: 0,
			filledAt: expect.any(Number),
		});

		await asUser(t, second).mutation(registrationMutations.register, { eventId });
		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({ registered: 1, waitlist: 1 });
	});

	it("tracks an unregistration that offers the seat onwards, and its acceptance", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const first = await insertUser(t, "forst@example.com");
		const second = await insertUser(t, "andre@example.com");
		await asUser(t, first).mutation(registrationMutations.register, { eventId });
		await asUser(t, second).mutation(registrationMutations.register, { eventId });
		const seated = await t.run((ctx) =>
			ctx.db
				.query("registrations")
				.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
				.collect(),
		);
		const firstRow = seated.find((row) => row.userId === first._id) as Doc<"registrations">;

		await asUser(t, first).mutation(registrationMutations.unregister, { id: firstRow._id });
		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({
			registered: 0,
			waitlist: 0,
			pending: 1,
		});

		const offered = await t.run((ctx) =>
			ctx.db
				.query("registrations")
				.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
				.first(),
		);
		await asUser(t, second).mutation(registrationMutations.acceptPendingRegistration, {
			id: (offered as Doc<"registrations">)._id,
		});
		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({
			registered: 1,
			pending: 0,
		});
	});

	it("tracks an expired offer", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const expiredUser = await insertUser(t, "utlopt@example.com");
		await insertRegistration(t, eventId, expiredUser._id, "pending", now - 30 * HOUR_IN_MS);
		const waitingUser = await insertUser(t, "venter@example.com");
		await insertRegistration(t, eventId, waitingUser._id, "waitlist", now - 10 * HOUR_IN_MS);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({ pending: 1, waitlist: 1 });
	});

	it("tracks a cleared waitlist", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10, eventStart: now });
		const seated = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seated._id, "registered", now);
		const offered = await insertUser(t, "tilbudt@example.com");
		await insertRegistration(t, eventId, offered._id, "pending", now + 1);
		const waiting = await insertUser(t, "venter@example.com");
		await insertRegistration(t, eventId, waiting._id, "waitlist", now + 2);

		await t.mutation(waitlistMutations.clearWaitlistAndPending, {});

		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({
			registered: 1,
			waitlist: 0,
			pending: 0,
		});
	});

	it("tracks attendance", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 5 });
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);
		const registrationIds: Id<"registrations">[] = [];
		for (const name of ["a", "b", "c"]) {
			const user = await insertUser(t, `${name}@example.com`);
			await insertStudent(t, user._id);
			registrationIds.push(await insertRegistration(t, eventId, user._id, "registered"));
		}

		await asUser(t, organizer).mutation(registrationMutations.updateAttendance, {
			id: registrationIds[0] as Id<"registrations">,
			newStatus: "confirmed",
		});
		await asUser(t, organizer).mutation(registrationMutations.updateAttendance, {
			id: registrationIds[1] as Id<"registrations">,
			newStatus: "late",
		});
		await asUser(t, organizer).mutation(registrationMutations.updateAttendance, {
			id: registrationIds[2] as Id<"registrations">,
			newStatus: "no_show",
		});

		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({
			attendanceRecorded: true,
			showedUp: 2,
			noShows: 1,
		});
	});

	it("drops a deleted user's registration from the row", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 5,
			eventStart: Date.now() + 5 * 24 * HOUR_IN_MS,
		});
		const leaving = await insertUser(t, "borte@example.com");
		const staying = await insertUser(t, "blir@example.com");
		await asUser(t, leaving).mutation(registrationMutations.register, { eventId });
		await asUser(t, staying).mutation(registrationMutations.register, { eventId });

		await t.mutation(internal.users.clerk.mutations.deleteFromClerk, {
			clerkUserId: leaving.externalId,
		});

		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({ registered: 1 });
	});

	it("counts a late unregistration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 2,
			eventStart: Date.now() + 2 * HOUR_IN_MS,
		});
		const user = await insertUser(t, "sen@example.com");
		await asUser(t, user).mutation(registrationMutations.register, { eventId });
		const row = await t.run((ctx) =>
			ctx.db
				.query("registrations")
				.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
				.first(),
		);

		await asUser(t, user).mutation(registrationMutations.unregister, {
			id: (row as Doc<"registrations">)._id,
		});

		expect(await expectStatsMatchRaw(t, eventId)).toMatchObject({
			registered: 0,
			lateUnregistrations: 1,
		});
	});
});
