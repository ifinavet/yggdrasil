import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import {
	createHarness,
	type Harness,
	seedEvent,
	seedOrganizer,
	seedRegistration,
	seedStudent,
} from "../../test.setup";

async function registrationsByStatus(t: Harness, eventId: Id<"events">) {
	const rows = await t.run(
		async (ctx) =>
			await ctx.db
				.query("registrations")
				.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
				.collect(),
	);

	return {
		registered: rows.filter((row) => row.status === "registered").length,
		pending: rows.filter((row) => row.status === "pending").length,
		waitlist: rows.filter((row) => row.status === "waitlist").length,
	};
}

function signUp(t: Harness, externalId: string, eventId: Id<"events">) {
	return t
		.withIdentity({ subject: externalId })
		.mutation(api.events.registrations.mutations.register, { eventId });
}

describe("register", () => {
	test("gives a seat when the event has room and no waitlist", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		await seedRegistration(t, eventId, "registered", Date.now() - 1000);

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("registered");
	});

	test("puts the newcomer on the waitlist when the event is full", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		await seedRegistration(t, eventId, "registered", Date.now() - 1000);

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("waitlist");
	});

	test("offers the free seat to the head of the queue instead of the newcomer", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const head = await seedRegistration(t, eventId, "waitlist", Date.now() - 2000);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("waitlist");

		const headRow = await t.run(async (ctx) => await ctx.db.get(head.registrationId));
		expect(headRow?.status).toBe("pending");

		expect(await registrationsByStatus(t, eventId)).toEqual({
			registered: 0,
			pending: 2,
			waitlist: 1,
		});
	});

	test("offers exactly as many seats as the event has free", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 3);
		await seedRegistration(t, eventId, "registered", Date.now() - 4000);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 3000);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 2000);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("waitlist");

		expect(await registrationsByStatus(t, eventId)).toEqual({
			registered: 1,
			pending: 2,
			waitlist: 2,
		});
	});

	test("gives the newcomer a seat when draining empties the queue", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 3);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("registered");

		expect(await registrationsByStatus(t, eventId)).toEqual({
			registered: 1,
			pending: 1,
			waitlist: 0,
		});
	});

	test("offers the seat past a waitlisted row whose user has been deleted", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const orphan = await seedRegistration(t, eventId, "waitlist", Date.now() - 2000);
		const head = await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		await t.run(async (ctx) => {
			await ctx.db.delete(orphan.userId);
		});

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("registered");

		const headRow = await t.run(async (ctx) => await ctx.db.get(head.registrationId));
		expect(headRow?.status).toBe("pending");
	});

	test("does not let a deleted user block the queue forever", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const orphan = await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		await t.run(async (ctx) => {
			await ctx.db.delete(orphan.userId);
		});

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("registered");
	});

	test("schedules the seat offer email for every promoted registration", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const head = await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		const newcomer = await seedStudent(t);
		await signUp(t, newcomer.externalId, eventId);

		const scheduled = await t.run(
			async (ctx) => await ctx.db.system.query("_scheduled_functions").collect(),
		);
		const headUser = await t.run(async (ctx) => await ctx.db.get(head.userId));

		expect(scheduled).toHaveLength(1);
		expect(scheduled[0]?.args[0]).toMatchObject({
			participantEmail: headUser?.email,
			registrationId: head.registrationId,
		});
	});
});

describe("unregister", () => {
	test("promotes the head of the queue when a seat is released", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const leaver = await seedRegistration(t, eventId, "registered", Date.now() - 2000);
		const head = await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		await t
			.withIdentity({ subject: leaver.externalId })
			.mutation(api.events.registrations.mutations.unregister, { id: leaver.registrationId });

		const headRow = await t.run(async (ctx) => await ctx.db.get(head.registrationId));
		expect(headRow?.status).toBe("pending");
	});
});

function checkIn(
	t: Harness,
	organizerExternalId: string,
	registrationId: Id<"registrations">,
	newStatus: "confirmed" | "late" | "no_show",
) {
	return t
		.withIdentity({ subject: organizerExternalId })
		.mutation(api.events.registrations.mutations.updateAttendance, {
			id: registrationId,
			newStatus,
		});
}

function registrationRow(t: Harness, registrationId: Id<"registrations">) {
	return t.run(async (ctx) => await ctx.db.get(registrationId));
}

describe("updateAttendance", () => {
	test.each([
		{
			scenario: "confirms a pending registration checked in while a seat is free",
			participationLimit: 2,
			seatsTaken: 0,
			initialStatus: "pending",
			expectedStatus: "registered",
		},
		{
			scenario: "leaves a pending registration pending when the event is at its limit",
			participationLimit: 1,
			seatsTaken: 1,
			initialStatus: "pending",
			expectedStatus: "pending",
		},
		{
			scenario: "never confirms a waitlisted registration",
			participationLimit: 5,
			seatsTaken: 0,
			initialStatus: "waitlist",
			expectedStatus: "waitlist",
		},
	] as const)(
		"$scenario",
		async ({ participationLimit, seatsTaken, initialStatus, expectedStatus }) => {
			const t = createHarness();
			const eventId = await seedEvent(t, participationLimit);
			const organizer = await seedOrganizer(t, eventId);

			for (let taken = 0; taken < seatsTaken; taken += 1) {
				await seedRegistration(t, eventId, "registered", Date.now() - 3000);
			}
			const attendee = await seedRegistration(t, eventId, initialStatus, Date.now() - 1000);

			await checkIn(t, organizer.externalId, attendee.registrationId, "confirmed");

			const row = await registrationRow(t, attendee.registrationId);
			expect(row?.status).toBe(expectedStatus);
			expect(row?.attendanceStatus).toBe("confirmed");
		},
	);

	test("does not hand a seat to a pending registration marked as a no show", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const organizer = await seedOrganizer(t, eventId);
		const absentee = await seedRegistration(t, eventId, "pending", Date.now() - 1000);

		await checkIn(t, organizer.externalId, absentee.registrationId, "no_show");

		const row = await registrationRow(t, absentee.registrationId);
		expect(row?.status).toBe("pending");
		expect(await t.run(async (ctx) => await ctx.db.query("points").collect())).toHaveLength(0);
	});

	test("confirms a pending registration that turns up late", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const organizer = await seedOrganizer(t, eventId);
		const attendee = await seedRegistration(t, eventId, "pending", Date.now() - 1000);

		await checkIn(t, organizer.externalId, attendee.registrationId, "late");

		const row = await registrationRow(t, attendee.registrationId);
		expect(row?.status).toBe("registered");
	});

	test("gives the attendee two points when a registered seat is marked as a no show", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const organizer = await seedOrganizer(t, eventId);
		const attendee = await seedRegistration(t, eventId, "registered", Date.now() - 1000);
		const student = await t.run(
			async (ctx) =>
				await ctx.db
					.query("students")
					.withIndex("by_userId", (q) => q.eq("userId", attendee.userId))
					.first(),
		);

		await checkIn(t, organizer.externalId, attendee.registrationId, "no_show");

		const points = await t.run(async (ctx) => await ctx.db.query("points").collect());
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({ severity: 2, studentId: student?._id });
	});

	test("rejects a caller who is neither organizer nor admin", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const attendee = await seedRegistration(t, eventId, "pending", Date.now() - 1000);
		const outsider = await seedStudent(t);

		await expect(
			checkIn(t, outsider.externalId, attendee.registrationId, "confirmed"),
		).rejects.toThrow();

		const row = await registrationRow(t, attendee.registrationId);
		expect(row?.status).toBe("pending");
		expect(row?.attendanceStatus).toBeUndefined();
	});
});

describe("acceptPendingRegistration", () => {
	function accept(t: Harness, externalId: string, registrationId: Id<"registrations">) {
		return t
			.withIdentity({ subject: externalId })
			.mutation(api.events.registrations.mutations.acceptPendingRegistration, {
				id: registrationId,
			});
	}

	test("turns an offered seat into a registration", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const holder = await seedRegistration(t, eventId, "pending", Date.now() - 1000);

		await accept(t, holder.externalId, holder.registrationId);

		const row = await registrationRow(t, holder.registrationId);
		expect(row?.status).toBe("registered");
	});

	test("refuses the second holder when only one seat exists", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const first = await seedRegistration(t, eventId, "pending", Date.now() - 2000);
		const second = await seedRegistration(t, eventId, "pending", Date.now() - 1000);

		await accept(t, first.externalId, first.registrationId);

		await expect(accept(t, second.externalId, second.registrationId)).rejects.toThrow();

		const row = await registrationRow(t, second.registrationId);
		expect(row?.status).toBe("pending");
	});

	test("refuses a registration that belongs to somebody else", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const holder = await seedRegistration(t, eventId, "pending", Date.now() - 1000);
		const outsider = await seedStudent(t);

		await expect(accept(t, outsider.externalId, holder.registrationId)).rejects.toThrow();
	});
});
