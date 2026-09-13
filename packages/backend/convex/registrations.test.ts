/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
	asUser,
	givePointsTo,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertStudent,
	insertUser,
	pointsFor,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../test/fixtures";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const HOUR_IN_MS = 60 * 60 * 1000;

async function registrationCountFor(t: TestBackend, eventId: Id<"events">) {
	return t.run(async (ctx) => {
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect();
		return registrations.length;
	});
}

async function statusOf(t: TestBackend, registrationId: Id<"registrations">) {
	return t.run(async (ctx) => (await ctx.db.get(registrationId))?.status ?? null);
}

describe("register", () => {
	it("is a no-op the second time and leaves a single registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");

		const first = await asUser(t, student).mutation(api.events.registrations.mutations.register, {
			eventId,
		});
		const second = await asUser(t, student).mutation(api.events.registrations.mutations.register, {
			eventId,
		});

		expect(first).toBe("registered");
		expect(second).toBeNull();
		expect(await registrationCountFor(t, eventId)).toBe(1);
	});

	it("refuses a locked user", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const lockedUser = await insertUser(t, "locked@example.com", { locked: true });

		const message = await refusalMessageFrom(
			asUser(t, lockedUser).mutation(api.events.registrations.mutations.register, { eventId }),
		);

		expect(message).toContain("låst");
		expect(await registrationCountFor(t, eventId)).toBe(0);
	});

	it("refuses a student with three points", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "prikket@example.com");
		const studentId = await insertStudent(t, student._id);
		await givePointsTo(t, studentId, 3);

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(api.events.registrations.mutations.register, { eventId }),
		);

		expect(message).toContain("3 eller flere prikker");
		expect(await registrationCountFor(t, eventId)).toBe(0);
	});

	it("refuses before registration opens", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: Date.now() + HOUR_IN_MS,
		});
		const student = await insertUser(t, "tidlig@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(api.events.registrations.mutations.register, { eventId }),
		);

		expect(message).toContain("har ikke åpnet ennå");
	});

	it("refuses after the event has started", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() - HOUR_IN_MS });
		const student = await insertUser(t, "sen@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(api.events.registrations.mutations.register, { eventId }),
		);

		expect(message).toContain("er stengt");
	});

	it("puts the caller on the waitlist when the participation limit is reached", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const seatHolder = await insertUser(t, "har-plass@example.com");
		await insertRegistration(t, eventId, seatHolder._id, "registered");
		const latecomer = await insertUser(t, "for-sen@example.com");

		const status = await asUser(t, latecomer).mutation(
			api.events.registrations.mutations.register,
			{ eventId },
		);

		expect(status).toBe("waitlist");
	});
});

describe("acceptPendingRegistration", () => {
	it("refuses someone who does not own the registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");
		const stranger = await insertUser(t, "fremmed@example.com");

		const message = await refusalMessageFrom(
			asUser(t, stranger).mutation(api.events.registrations.mutations.acceptPendingRegistration, {
				id: registrationId,
			}),
		);

		expect(message).toContain("tilhører ikke deg");
		expect(await statusOf(t, registrationId)).toBe("pending");
	});

	it("refuses an owner who has picked up three points in the meantime", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "prikket-eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");
		await givePointsTo(t, studentId, 3);

		const message = await refusalMessageFrom(
			asUser(t, owner).mutation(api.events.registrations.mutations.acceptPendingRegistration, {
				id: registrationId,
			}),
		);

		expect(message).toContain("3 eller flere prikker");
		expect(await statusOf(t, registrationId)).toBe("pending");
	});

	it("accepts an eligible owner", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");

		await asUser(t, owner).mutation(api.events.registrations.mutations.acceptPendingRegistration, {
			id: registrationId,
		});

		expect(await statusOf(t, registrationId)).toBe("registered");
	});
});

describe("unregister", () => {
	it("refuses a stranger", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		const stranger = await insertUser(t, "fremmed@example.com");

		const message = await refusalMessageFrom(
			asUser(t, stranger).mutation(api.events.registrations.mutations.unregister, {
				id: registrationId,
			}),
		);

		expect(message).toContain("ikke tilgang");
		expect(await statusOf(t, registrationId)).toBe("registered");
	});

	it("lets the owner unregister", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		await asUser(t, owner).mutation(api.events.registrations.mutations.unregister, {
			id: registrationId,
		});

		expect(await statusOf(t, registrationId)).toBeNull();
	});

	it("gives the owner a point when they leave less than 24 hours before the start", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR_IN_MS });
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		await asUser(t, owner).mutation(api.events.registrations.mutations.unregister, {
			id: registrationId,
		});

		expect(await pointsFor(t, studentId)).toHaveLength(1);
	});

	it("gives no point when an organizer removes someone late", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR_IN_MS });
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(api.events.registrations.mutations.unregister, {
			id: registrationId,
		});

		expect(await pointsFor(t, studentId)).toHaveLength(0);
	});
});

describe("updateNote", () => {
	it("refuses another student", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		const otherStudent = await insertUser(t, "annen@example.com");

		const message = await refusalMessageFrom(
			asUser(t, otherStudent).mutation(api.events.registrations.mutations.updateNote, {
				id: registrationId,
				note: "Allergisk mot alt",
			}),
		);

		expect(message).toContain("annen bruker");
	});
});

describe("updateAttendance", () => {
	it("refuses a plain student", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		await insertStudent(t, attendee._id);
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const bystander = await insertUser(t, "tilskuer@example.com");

		const message = await refusalMessageFrom(
			asUser(t, bystander).mutation(api.events.registrations.mutations.updateAttendance, {
				id: registrationId,
				newStatus: "confirmed",
			}),
		);

		expect(message).toContain("Bare arrangører eller administratorer");
	});

	it.each([
		{ newStatus: "confirmed" as const, expectedPoints: 0 },
		{ newStatus: "late" as const, expectedPoints: 1 },
		{ newStatus: "no_show" as const, expectedPoints: 2 },
	])("gives $expectedPoints points for $newStatus", async ({ newStatus, expectedPoints }) => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		const studentId = await insertStudent(t, attendee._id);
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(api.events.registrations.mutations.updateAttendance, {
			id: registrationId,
			newStatus,
		});

		const totalPoints = (await pointsFor(t, studentId)).reduce(
			(total, point) => total + point.severity,
			0,
		);
		expect(totalPoints).toBe(expectedPoints);
	});

	it("lets an event organizer without any role confirm attendance", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		await insertStudent(t, attendee._id);
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(api.events.registrations.mutations.updateAttendance, {
			id: registrationId,
			newStatus: "confirmed",
		});

		const attendance = await t.run(
			async (ctx) => (await ctx.db.get(registrationId))?.attendanceStatus,
		);
		expect(attendance).toBe("confirmed");
	});
});
