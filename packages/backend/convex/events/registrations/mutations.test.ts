import { describe, expect, it } from "vitest";
import {
	asUser,
	countRegistrationsForEvent,
	DAY_IN_MS,
	emailsWithStatus,
	givePointsTo,
	HOUR_IN_MS,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertStudent,
	insertUser,
	pointsFor,
	refusalMessageFrom,
	registrationById,
	scheduledRecipientsOf,
	setup,
	statusOf,
	totalPointsFor,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";

const mutations = api.events.registrations.mutations;

describe("register", () => {
	it("seats the first registrant", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");

		const status = await asUser(t, student).mutation(mutations.register, { eventId });

		expect(status).toBe("registered");
		expect(await countRegistrationsForEvent(t, eventId)).toBe(1);
	});

	it("is a no-op the second time and leaves a single registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");

		await asUser(t, student).mutation(mutations.register, { eventId });
		const second = await asUser(t, student).mutation(mutations.register, { eventId });

		expect(second).toBeNull();
		expect(await countRegistrationsForEvent(t, eventId)).toBe(1);
	});

	it("waitlists once the participation limit is reached", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const firstStudent = await insertUser(t, "forst@example.com");
		const secondStudent = await insertUser(t, "andre@example.com");

		const first = await asUser(t, firstStudent).mutation(mutations.register, { eventId });
		const second = await asUser(t, secondStudent).mutation(mutations.register, { eventId });

		expect(first).toBe("registered");
		expect(second).toBe("waitlist");
	});

	it("counts pending registrations against the participation limit", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const offered = await insertUser(t, "tilbudt@example.com");
		await insertRegistration(t, eventId, offered._id, "pending");
		const latecomer = await insertUser(t, "sen@example.com");

		const status = await asUser(t, latecomer).mutation(mutations.register, { eventId });

		expect(status).toBe("waitlist");
	});

	it("waitlists a registrant while anyone is waitlisted, even below the limit", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });
		const waiting = await insertUser(t, "venter@example.com");
		await insertRegistration(t, eventId, waiting._id, "waitlist");
		const newcomer = await insertUser(t, "ny@example.com");

		const status = await asUser(t, newcomer).mutation(mutations.register, { eventId });

		expect(status).toBe("waitlist");
	});

	it("refuses an unauthenticated caller", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);

		const message = await refusalMessageFrom(t.mutation(mutations.register, { eventId }));

		expect(message).toContain("innlogget");
		expect(await countRegistrationsForEvent(t, eventId)).toBe(0);
	});

	it("refuses a locked user", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const lockedUser = await insertUser(t, "laast@example.com", { locked: true });

		const message = await refusalMessageFrom(
			asUser(t, lockedUser).mutation(mutations.register, { eventId }),
		);

		expect(message).toContain("låst");
		expect(await countRegistrationsForEvent(t, eventId)).toBe(0);
	});

	it("refuses a student with three points", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "prikket@example.com");
		const studentId = await insertStudent(t, student._id);
		await givePointsTo(t, studentId, 3);

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(mutations.register, { eventId }),
		);

		expect(message).toContain("3 eller flere prikker");
		expect(await countRegistrationsForEvent(t, eventId)).toBe(0);
	});

	it("allows a student who is still under three points", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "toprikker@example.com");
		const studentId = await insertStudent(t, student._id);
		await givePointsTo(t, studentId, 2);

		const status = await asUser(t, student).mutation(mutations.register, { eventId });

		expect(status).toBe("registered");
	});

	it("refuses a registration before registration opens", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: Date.now() + HOUR_IN_MS,
		});
		const student = await insertUser(t, "tidlig@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(mutations.register, { eventId }),
		);

		expect(message).toContain("har ikke åpnet ennå");
	});

	it("refuses a registration once the event has started", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: Date.now() - 2 * DAY_IN_MS,
			eventStart: Date.now() - HOUR_IN_MS,
		});
		const student = await insertUser(t, "sent@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(mutations.register, { eventId }),
		);

		expect(message).toContain("er stengt");
	});

	it("returns null instead of refusing when an existing registrant calls after the event started", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: Date.now() - 2 * DAY_IN_MS,
			eventStart: Date.now() - HOUR_IN_MS,
		});
		const student = await insertUser(t, "allerede@example.com");
		await insertRegistration(t, eventId, student._id, "registered");

		const status = await asUser(t, student).mutation(mutations.register, { eventId });

		expect(status).toBeNull();
	});

	it("refuses a registration for an event that no longer exists", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		await t.run((ctx) => ctx.db.delete(eventId));
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(mutations.register, { eventId }),
		);

		expect(message).toContain("ble ikke funnet");
	});
});

describe("acceptPendingRegistration", () => {
	it("turns a pending offer into a seat", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");

		await asUser(t, owner).mutation(mutations.acceptPendingRegistration, { id: registrationId });

		expect(await statusOf(t, registrationId)).toBe("registered");
	});

	it("refuses someone who does not own the registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");
		const stranger = await insertUser(t, "fremmed@example.com");

		const message = await refusalMessageFrom(
			asUser(t, stranger).mutation(mutations.acceptPendingRegistration, { id: registrationId }),
		);

		expect(message).toContain("tilhører ikke deg");
		expect(await statusOf(t, registrationId)).toBe("pending");
	});

	it.each(["registered", "waitlist"] as const)("refuses a %s registration", async (status) => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, status);

		const message = await refusalMessageFrom(
			asUser(t, owner).mutation(mutations.acceptPendingRegistration, { id: registrationId }),
		);

		expect(message).toContain("Kun ventende påmeldinger kan godtas");
		expect(await statusOf(t, registrationId)).toBe(status);
	});

	it("refuses an offer once the event has started", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() - HOUR_IN_MS });
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");

		const message = await refusalMessageFrom(
			asUser(t, owner).mutation(mutations.acceptPendingRegistration, { id: registrationId }),
		);

		expect(message).toContain("allerede startet");
		expect(await statusOf(t, registrationId)).toBe("pending");
	});

	it("refuses an offer when the seats are already taken", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const seated = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seated._id, "registered");
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");

		const message = await refusalMessageFrom(
			asUser(t, owner).mutation(mutations.acceptPendingRegistration, { id: registrationId }),
		);

		expect(message).toContain("er fullt");
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
			asUser(t, owner).mutation(mutations.acceptPendingRegistration, { id: registrationId }),
		);

		expect(message).toContain("3 eller flere prikker");
		expect(await statusOf(t, registrationId)).toBe("pending");
	});

	it("refuses an owner whose account has been locked", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "laast-eier@example.com", { locked: true });
		const registrationId = await insertRegistration(t, eventId, owner._id, "pending");

		const message = await refusalMessageFrom(
			asUser(t, owner).mutation(mutations.acceptPendingRegistration, { id: registrationId }),
		);

		expect(message).toContain("låst");
		expect(await statusOf(t, registrationId)).toBe("pending");
	});
});

describe("unregister", () => {
	it("lets the owner unregister", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		await asUser(t, owner).mutation(mutations.unregister, { id: registrationId });

		expect(await statusOf(t, registrationId)).toBeNull();
	});

	it("lets an event organizer remove somebody else", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(mutations.unregister, { id: registrationId });

		expect(await statusOf(t, registrationId)).toBeNull();
	});

	it("refuses a stranger", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		const stranger = await insertUser(t, "fremmed@example.com");

		const message = await refusalMessageFrom(
			asUser(t, stranger).mutation(mutations.unregister, { id: registrationId }),
		);

		expect(message).toContain("ikke tilgang");
		expect(await statusOf(t, registrationId)).toBe("registered");
	});

	it("offers the freed seat to the longest waiting registrant and emails them", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered", now);
		const firstWaiting = await insertUser(t, "forst-i-ko@example.com");
		const firstWaitingId = await insertRegistration(
			t,
			eventId,
			firstWaiting._id,
			"waitlist",
			now + 1,
		);
		const secondWaiting = await insertUser(t, "andre-i-ko@example.com");
		const secondWaitingId = await insertRegistration(
			t,
			eventId,
			secondWaiting._id,
			"waitlist",
			now + 2,
		);

		await asUser(t, owner).mutation(mutations.unregister, { id: registrationId });

		expect(await statusOf(t, firstWaitingId)).toBe("pending");
		expect(await statusOf(t, secondWaitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([
			"forst-i-ko@example.com",
		]);
	});

	it("does not advance the waitlist when a waitlisted registrant leaves, even with seats free", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });
		const leaving = await insertUser(t, "forlater@example.com");
		const leavingId = await insertRegistration(t, eventId, leaving._id, "waitlist", now);
		const stayingWaiting = await insertUser(t, "blir@example.com");
		const stayingWaitingId = await insertRegistration(
			t,
			eventId,
			stayingWaiting._id,
			"waitlist",
			now + 1,
		);

		await asUser(t, leaving).mutation(mutations.unregister, { id: leavingId });

		expect(await statusOf(t, stayingWaitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([]);
	});

	it("leaves the waitlist untouched when the freed seat is still filled by others", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const leaving = await insertUser(t, "forlater@example.com");
		const leavingId = await insertRegistration(t, eventId, leaving._id, "registered", now);
		const alreadyOffered = await insertUser(t, "tilbudt@example.com");
		await insertRegistration(t, eventId, alreadyOffered._id, "pending", now + 1);
		const waiting = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waiting._id, "waitlist", now + 2);

		await asUser(t, leaving).mutation(mutations.unregister, { id: leavingId });

		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([]);
	});

	it("gives the owner a point when they leave less than 24 hours before the start", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR_IN_MS });
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		await asUser(t, owner).mutation(mutations.unregister, { id: registrationId });

		expect(await totalPointsFor(t, studentId)).toBe(1);
	});

	it("gives no point when the owner leaves more than 24 hours before the start", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + 2 * DAY_IN_MS });
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		await asUser(t, owner).mutation(mutations.unregister, { id: registrationId });

		expect(await pointsFor(t, studentId)).toHaveLength(0);
	});

	it("gives no point when an organizer removes someone late", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR_IN_MS });
		const attendee = await insertUser(t, "deltaker@example.com");
		const studentId = await insertStudent(t, attendee._id);
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(mutations.unregister, { id: registrationId });

		expect(await pointsFor(t, studentId)).toHaveLength(0);
	});

	it("gives no point when a waitlisted registrant leaves late", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR_IN_MS });
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const registrationId = await insertRegistration(t, eventId, owner._id, "waitlist");

		await asUser(t, owner).mutation(mutations.unregister, { id: registrationId });

		expect(await pointsFor(t, studentId)).toHaveLength(0);
	});

	it("gives no point when the leaving owner is not a student", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR_IN_MS });
		const owner = await insertUser(t, "ikkestudent@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		await asUser(t, owner).mutation(mutations.unregister, { id: registrationId });

		expect(await statusOf(t, registrationId)).toBeNull();
	});

	it("reports the removed registration, the event and the caller", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		const result = await asUser(t, owner).mutation(mutations.unregister, { id: registrationId });

		expect(result.deletedRegistration._id).toBe(registrationId);
		expect(result.event._id).toBe(eventId);
		expect(result.person._id).toBe(owner._id);
	});

	it("refuses a registration that no longer exists", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		await t.run((ctx) => ctx.db.delete(registrationId));

		const message = await refusalMessageFrom(
			asUser(t, owner).mutation(mutations.unregister, { id: registrationId }),
		);

		expect(message).toContain("ble ikke funnet");
	});
});

describe("updateNote", () => {
	it("lets the owner set their own note", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		await asUser(t, owner).mutation(mutations.updateNote, {
			id: registrationId,
			note: "Vegetarianer",
		});

		expect((await registrationById(t, registrationId))?.note).toBe("Vegetarianer");
	});

	it("lets an organizer edit somebody else's note", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(mutations.updateNote, {
			id: registrationId,
			note: "Allergisk mot nøtter",
		});

		expect((await registrationById(t, registrationId))?.note).toBe("Allergisk mot nøtter");
	});

	it("refuses another student", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		const otherStudent = await insertUser(t, "annen@example.com");

		const message = await refusalMessageFrom(
			asUser(t, otherStudent).mutation(mutations.updateNote, {
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
			asUser(t, bystander).mutation(mutations.updateAttendance, {
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

		await asUser(t, organizer).mutation(mutations.updateAttendance, {
			id: registrationId,
			newStatus,
		});

		expect(await totalPointsFor(t, studentId)).toBe(expectedPoints);
		expect((await registrationById(t, registrationId))?.attendanceStatus).toBe(newStatus);
	});

	it("records attendance without points for a waitlisted registrant", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const waiting = await insertUser(t, "venter@example.com");
		const studentId = await insertStudent(t, waiting._id);
		const registrationId = await insertRegistration(t, eventId, waiting._id, "waitlist");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(mutations.updateAttendance, {
			id: registrationId,
			newStatus: "no_show",
		});

		expect((await registrationById(t, registrationId))?.attendanceStatus).toBe("no_show");
		expect(await pointsFor(t, studentId)).toHaveLength(0);
	});

	it("refuses a registered attendee who has no student record and records no attendance", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "ikkestudent@example.com");
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const message = await refusalMessageFrom(
			asUser(t, organizer).mutation(mutations.updateAttendance, {
				id: registrationId,
				newStatus: "confirmed",
			}),
		);

		expect(message).toContain("ikke funnet");
		expect((await registrationById(t, registrationId))?.attendanceStatus).toBeUndefined();
	});

	it("emails the student about the points they were given", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		await insertStudent(t, attendee._id);
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		await asUser(t, organizer).mutation(mutations.updateAttendance, {
			id: registrationId,
			newStatus: "late",
		});

		expect(await scheduledRecipientsOf(t, "sendGottenPointsEmail")).toEqual([
			"deltaker@example.com",
		]);
	});
});

describe("makeStatusPending via the waitlist promotion path", () => {
	it("promotes in registration-time order across repeated seat releases", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 2 });
		const firstSeated = await insertUser(t, "sitter-1@example.com");
		const firstSeatedId = await insertRegistration(t, eventId, firstSeated._id, "registered", now);
		const secondSeated = await insertUser(t, "sitter-2@example.com");
		const secondSeatedId = await insertRegistration(
			t,
			eventId,
			secondSeated._id,
			"registered",
			now + 1,
		);
		const earlyWaiting = await insertUser(t, "tidlig-venter@example.com");
		await insertRegistration(t, eventId, earlyWaiting._id, "waitlist", now + 2);
		const lateWaiting = await insertUser(t, "sen-venter@example.com");
		await insertRegistration(t, eventId, lateWaiting._id, "waitlist", now + 3);

		await asUser(t, firstSeated).mutation(mutations.unregister, { id: firstSeatedId });
		await asUser(t, secondSeated).mutation(mutations.unregister, { id: secondSeatedId });

		expect(await emailsWithStatus(t, eventId, "pending")).toEqual([
			"sen-venter@example.com",
			"tidlig-venter@example.com",
		]);
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([
			"tidlig-venter@example.com",
			"sen-venter@example.com",
		]);
	});
});
