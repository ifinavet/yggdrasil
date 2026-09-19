import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { modules } from "../../testModules";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function createHarness() {
	return convexTest(schema, modules);
}

type Harness = ReturnType<typeof createHarness>;

let nextExternalId = 0;

beforeEach(() => {
	nextExternalId = 0;
});

async function seedEvent(t: Harness, participationLimit: number) {
	return await t.run(async (ctx) => {
		const image = await ctx.storage.store(new Blob(["logo"]));
		const logo = await ctx.db.insert("companyLogos", { name: "logo", image });
		const hostingCompany = await ctx.db.insert("companies", {
			orgNumber: 123456789,
			name: "Testbedrift",
			description: "",
			mainSponsor: false,
			logo,
		});

		return await ctx.db.insert("events", {
			title: "Bedriftspresentasjon",
			teaser: "",
			description: "",
			eventStart: Date.now() + ONE_DAY_MS,
			registrationOpens: Date.now() - ONE_DAY_MS,
			participationLimit,
			location: "Ole-Johan Dahls hus",
			food: "Pizza",
			language: "Norsk",
			ageRestriction: "Ingen",
			externalEvent: false,
			hostingCompany,
			published: true,
		});
	});
}

async function seedStudent(t: Harness) {
	nextExternalId += 1;
	const externalId = `student-${nextExternalId}`;

	const userId = await t.run(async (ctx) => {
		const id = await ctx.db.insert("users", {
			email: `${externalId}@uio.no`,
			firstName: "Test",
			lastName: externalId,
			image: "",
			externalId,
			locked: false,
		});

		await ctx.db.insert("students", {
			userId: id,
			name: `Test ${externalId}`,
			studyProgram: "Informatikk",
			year: 2,
			degree: "Bachelor",
		});

		return id;
	});

	return { userId, externalId };
}

async function seedOrganizer(t: Harness, eventId: Id<"events">) {
	const organizer = await seedStudent(t);

	await t.run(async (ctx) => {
		await ctx.db.insert("eventOrganizers", {
			eventId,
			userId: organizer.userId,
			role: "hovedansvarlig",
		});
	});

	return organizer;
}

async function seedRegistration(
	t: Harness,
	eventId: Id<"events">,
	status: Doc<"registrations">["status"],
	registrationTime: number,
) {
	const { userId, externalId } = await seedStudent(t);

	const registrationId = await t.run(
		async (ctx) =>
			await ctx.db.insert("registrations", { eventId, userId, status, registrationTime }),
	);

	return { userId, externalId, registrationId };
}

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

	test("skips a waitlisted row whose user has been deleted", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const orphan = await seedRegistration(t, eventId, "waitlist", Date.now() - 2000);
		const head = await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		await t.run(async (ctx) => {
			await ctx.db.delete(orphan.userId);
		});

		const newcomer = await seedStudent(t);

		await expect(signUp(t, newcomer.externalId, eventId)).resolves.toBe("waitlist");

		const headRow = await t.run(async (ctx) => await ctx.db.get(head.registrationId));
		expect(headRow?.status).toBe("pending");
	});

	test("schedules the seat offer email for every promoted registration", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		const newcomer = await seedStudent(t);
		await signUp(t, newcomer.externalId, eventId);

		const scheduled = await t.run(
			async (ctx) => await ctx.db.system.query("_scheduled_functions").collect(),
		);

		expect(scheduled).toHaveLength(1);
		expect(scheduled[0]?.name).toContain("sendAvailableSeatEmail");
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

describe("updateAttendance", () => {
	test("confirms a pending registration that is checked in while there is room", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const organizer = await seedOrganizer(t, eventId);
		const attendee = await seedRegistration(t, eventId, "pending", Date.now() - 1000);

		await t
			.withIdentity({ subject: organizer.externalId })
			.mutation(api.events.registrations.mutations.updateAttendance, {
				id: attendee.registrationId,
				newStatus: "confirmed",
			});

		const row = await t.run(async (ctx) => await ctx.db.get(attendee.registrationId));
		expect(row?.status).toBe("registered");
		expect(row?.attendanceStatus).toBe("confirmed");
	});

	test("records attendance without confirming when the event is already at its limit", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 1);
		const organizer = await seedOrganizer(t, eventId);
		await seedRegistration(t, eventId, "registered", Date.now() - 2000);
		const attendee = await seedRegistration(t, eventId, "pending", Date.now() - 1000);

		await t
			.withIdentity({ subject: organizer.externalId })
			.mutation(api.events.registrations.mutations.updateAttendance, {
				id: attendee.registrationId,
				newStatus: "confirmed",
			});

		const row = await t.run(async (ctx) => await ctx.db.get(attendee.registrationId));
		expect(row?.status).toBe("pending");
		expect(row?.attendanceStatus).toBe("confirmed");
	});

	test("never confirms a waitlisted registration", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 5);
		const organizer = await seedOrganizer(t, eventId);
		const attendee = await seedRegistration(t, eventId, "waitlist", Date.now() - 1000);

		await t
			.withIdentity({ subject: organizer.externalId })
			.mutation(api.events.registrations.mutations.updateAttendance, {
				id: attendee.registrationId,
				newStatus: "confirmed",
			});

		const row = await t.run(async (ctx) => await ctx.db.get(attendee.registrationId));
		expect(row?.status).toBe("waitlist");
		expect(row?.attendanceStatus).toBe("confirmed");
	});

	test("gives a point when a freshly confirmed attendee is marked as a no show", async () => {
		const t = createHarness();
		const eventId = await seedEvent(t, 2);
		const organizer = await seedOrganizer(t, eventId);
		const attendee = await seedRegistration(t, eventId, "pending", Date.now() - 1000);

		await t
			.withIdentity({ subject: organizer.externalId })
			.mutation(api.events.registrations.mutations.updateAttendance, {
				id: attendee.registrationId,
				newStatus: "no_show",
			});

		const points = await t.run(async (ctx) => await ctx.db.query("points").collect());
		expect(points).toHaveLength(1);
		expect(points[0]?.severity).toBe(2);
	});
});
