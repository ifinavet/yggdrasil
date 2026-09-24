import { toBase64 } from "@workspace/shared/utils";
import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertStudent,
	insertUser,
	refusalMessageFrom,
	setup,
	setupEventWithOneOfEachStatus,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";

const queries = api.events.registrations.queries;

describe("getByEventId", () => {
	it("groups outstanding offers together with the seated registrants", async () => {
		const { t, eventId } = await setupEventWithOneOfEachStatus();
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const lists = await asUser(t, organizer).query(queries.getByEventId, {
			eventIdentifier: eventId,
		});

		expect(lists.registered.map((entry) => entry.userEmail)).toEqual([
			"sitter@example.com",
			"tilbudt@example.com",
		]);
		expect(lists.waitlist.map((entry) => entry.userEmail)).toEqual(["venter@example.com"]);
	});

	it("names each registrant", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const seated = await insertUser(t, "sitter@example.com", {
			firstName: "Kari",
			lastName: "Nordmann",
		});
		await insertRegistration(t, eventId, seated._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const lists = await asUser(t, organizer).query(queries.getByEventId, {
			eventIdentifier: eventId,
		});

		expect(lists.registered[0].userName).toBe("Kari Nordmann");
	});

	it("falls back to placeholders when the registrant is gone", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const departed = await insertUser(t, "slettet@example.com");
		await insertRegistration(t, eventId, departed._id, "registered");
		await t.run((ctx) => ctx.db.delete(departed._id));
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const lists = await asUser(t, organizer).query(queries.getByEventId, {
			eventIdentifier: eventId,
		});

		expect(lists.registered[0].userName).toBe("Ukjent bruker");
		expect(lists.registered[0].userEmail).toBe("Ukjent e-post");
	});

	it("accepts the event slug as identifier", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { slug: "host-fest-2026" });
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const lists = await asUser(t, organizer).query(queries.getByEventId, {
			eventIdentifier: "host-fest-2026",
		});

		expect(lists.registered).toEqual([]);
		expect(lists.waitlist).toEqual([]);
	});

	it("lets an admin read the list without organizing the event", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");

		const lists = await asUser(t, admin).query(queries.getByEventId, {
			eventIdentifier: eventId,
		});

		expect(lists.registered).toEqual([]);
	});

	it("refuses a plain student", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).query(queries.getByEventId, { eventIdentifier: eventId }),
		);

		expect(message).toContain("Bare arrangører eller administratorer");
	});

	it("refuses an unauthenticated caller", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);

		const message = await refusalMessageFrom(
			t.query(queries.getByEventId, { eventIdentifier: eventId }),
		);

		expect(message).toContain("innlogget");
	});

	it("refuses an unknown identifier", async () => {
		const { t, companyId } = await setup();
		await insertEvent(t, companyId);
		const organizer = await insertUser(t, "arrangor@example.com");

		const message = await refusalMessageFrom(
			asUser(t, organizer).query(queries.getByEventId, { eventIdentifier: "finnes-ikke" }),
		);

		expect(message).toContain("Arrangementet ble ikke funnet");
	});
});

describe("getEventRegistrationSummary", () => {
	it("counts outstanding offers as taken seats and reports the waitlist separately", async () => {
		const { t, eventId } = await setupEventWithOneOfEachStatus();

		const summary = await t.query(queries.getEventRegistrationSummary, {
			eventIdentifier: eventId,
		});

		expect(summary.registeredCount).toBe(2);
		expect(summary.waitlistCount).toBe(1);
	});

	it("tells an anonymous visitor nothing about an own registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const seated = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seated._id, "registered");

		const summary = await t.query(queries.getEventRegistrationSummary, {
			eventIdentifier: eventId,
		});

		expect(summary.ownRegistration).toBeNull();
		expect(summary.ownWaitlistPosition).toBeNull();
	});

	it("reports the caller's own registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");
		const registrationId = await insertRegistration(t, eventId, student._id, "registered");

		const summary = await asUser(t, student).query(queries.getEventRegistrationSummary, {
			eventIdentifier: eventId,
		});

		expect(summary.ownRegistration?._id).toBe(registrationId);
		expect(summary.ownWaitlistPosition).toBeNull();
	});

	it("numbers the caller's place in the queue from one", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const seated = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seated._id, "registered", now);
		const firstWaiting = await insertUser(t, "venter-1@example.com");
		await insertRegistration(t, eventId, firstWaiting._id, "waitlist", now + 1);
		const secondWaiting = await insertUser(t, "venter-2@example.com");
		await insertRegistration(t, eventId, secondWaiting._id, "waitlist", now + 2);

		const firstSummary = await asUser(t, firstWaiting).query(queries.getEventRegistrationSummary, {
			eventIdentifier: eventId,
		});
		const secondSummary = await asUser(t, secondWaiting).query(
			queries.getEventRegistrationSummary,
			{ eventIdentifier: eventId },
		);

		expect(firstSummary.ownWaitlistPosition).toBe(1);
		expect(secondSummary.ownWaitlistPosition).toBe(2);
	});

	it("hides an unpublished event from the public", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { published: false });

		const message = await refusalMessageFrom(
			t.query(queries.getEventRegistrationSummary, { eventIdentifier: eventId }),
		);

		expect(message).toContain("Arrangementet ble ikke funnet");
	});

	it("shows an unpublished event to an internal user", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { published: false });
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");

		const summary = await asUser(t, internalUser).query(queries.getEventRegistrationSummary, {
			eventIdentifier: eventId,
		});

		expect(summary.registeredCount).toBe(0);
	});

	it("accepts the event slug as identifier", async () => {
		const { t, companyId } = await setup();
		await insertEvent(t, companyId, { slug: "host-fest-2026" });

		const summary = await t.query(queries.getEventRegistrationSummary, {
			eventIdentifier: "host-fest-2026",
		});

		expect(summary.registeredCount).toBe(0);
	});
});

describe("getById", () => {
	it("lets the owner read their registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		const registration = await asUser(t, owner).query(queries.getById, { id: registrationId });

		expect(registration._id).toBe(registrationId);
	});

	it("lets an organizer read somebody else's registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const registration = await asUser(t, organizer).query(queries.getById, {
			id: registrationId,
		});

		expect(registration.userId).toBe(attendee._id);
	});

	it("refuses a stranger", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		const stranger = await insertUser(t, "fremmed@example.com");

		const message = await refusalMessageFrom(
			asUser(t, stranger).query(queries.getById, { id: registrationId }),
		);

		expect(message).toContain("ikke tilgang");
	});

	it("refuses a registration that no longer exists", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");
		await t.run((ctx) => ctx.db.delete(registrationId));

		const message = await refusalMessageFrom(
			asUser(t, owner).query(queries.getById, { id: registrationId }),
		);

		expect(message).toContain("ikke funnet");
	});
});

describe("getCurrentUserRegistertToEventBySlug", () => {
	it("confirms a seated registrant", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { slug: "host-fest-2026" });
		const student = await insertUser(t, "student@example.com");
		await insertRegistration(t, eventId, student._id, "registered");

		const userId = await asUser(t, student).query(queries.getCurrentUserRegistertToEventBySlug, {
			slug: "host-fest-2026",
		});

		expect(userId).toBe(student._id);
	});

	it("refuses a waitlisted registrant", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { slug: "host-fest-2026" });
		const student = await insertUser(t, "student@example.com");
		await insertRegistration(t, eventId, student._id, "waitlist");

		const message = await refusalMessageFrom(
			asUser(t, student).query(queries.getCurrentUserRegistertToEventBySlug, {
				slug: "host-fest-2026",
			}),
		);

		expect(message).toContain("ikke registrert");
	});

	it("refuses an unknown slug", async () => {
		const { t } = await setup();
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).query(queries.getCurrentUserRegistertToEventBySlug, {
				slug: "finnes-ikke",
			}),
		);

		expect(message).toContain("ikke funnet");
	});
});

describe("getCurrentUser", () => {
	it("returns the caller's own registrations with event details", async () => {
		const { t, companyId } = await setup();
		const eventStart = Date.now() + 3 * 24 * 60 * 60 * 1000;
		const eventId = await insertEvent(t, companyId, { title: "Bedriftsbesøk", eventStart });
		const student = await insertUser(t, "student@example.com");
		await insertRegistration(t, eventId, student._id, "waitlist");
		const otherStudent = await insertUser(t, "annen@example.com");
		await insertRegistration(t, eventId, otherStudent._id, "registered");

		const registrations = await asUser(t, student).query(queries.getCurrentUser, {});

		expect(registrations).toHaveLength(1);
		expect(registrations[0].eventTitle).toBe("Bedriftsbesøk");
		expect(registrations[0].eventStart).toBe(eventStart);
		expect(registrations[0].status).toBe("waitlist");
	});

	it("refuses an unauthenticated caller", async () => {
		const { t } = await setup();

		const message = await refusalMessageFrom(t.query(queries.getCurrentUser, {}));

		expect(message).toContain("innlogget");
	});

	it("refuses when a registration points at a deleted event", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");
		await insertRegistration(t, eventId, student._id, "registered");
		await t.run((ctx) => ctx.db.delete(eventId));

		const message = await refusalMessageFrom(asUser(t, student).query(queries.getCurrentUser, {}));

		expect(message).toContain("ble ikke funnet");
	});
});

describe("getUserByRegistrationId", () => {
	it("names the registrant for an organizer", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com", {
			firstName: "Ola",
			lastName: "Nordmann",
		});
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const name = await asUser(t, organizer).query(queries.getUserByRegistrationId, {
			id: registrationId,
		});

		expect(name).toEqual({ firstName: "Ola", lastName: "Nordmann" });
	});

	it("refuses the registrant themselves", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");

		const message = await refusalMessageFrom(
			asUser(t, attendee).query(queries.getUserByRegistrationId, { id: registrationId }),
		);

		expect(message).toContain("ikke tilgang");
	});

	it("returns null for a missing registration without checking access", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		const registrationId = await insertRegistration(t, eventId, attendee._id, "registered");
		await t.run((ctx) => ctx.db.delete(registrationId));
		const stranger = await insertUser(t, "fremmed@example.com");

		const name = await asUser(t, stranger).query(queries.getUserByRegistrationId, {
			id: registrationId,
		});

		expect(name).toBeNull();
	});

	it("returns null when the registrant is gone", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const departed = await insertUser(t, "slettet@example.com");
		const registrationId = await insertRegistration(t, eventId, departed._id, "registered");
		await t.run((ctx) => ctx.db.delete(departed._id));
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const name = await asUser(t, organizer).query(queries.getUserByRegistrationId, {
			id: registrationId,
		});

		expect(name).toBeNull();
	});
});

describe("getRegistrantsInfo", () => {
	it("counts seated registrants by degree, study program and year", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const firstStudent = await insertUser(t, "student-1@example.com");
		await insertStudent(t, firstStudent._id, { studyProgram: "Informatikk", year: 2 });
		await insertRegistration(t, eventId, firstStudent._id, "registered");
		const secondStudent = await insertUser(t, "student-2@example.com");
		await insertStudent(t, secondStudent._id, { studyProgram: "Informatikk", year: 2 });
		await insertRegistration(t, eventId, secondStudent._id, "registered");
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");

		const info = await asUser(t, internalUser).query(queries.getRegistrantsInfo, {
			eventIdentifier: eventId,
		});

		expect(info).toEqual({ [toBase64("Bachelor")]: { [toBase64("Informatikk")]: { 2: 2 } } });
	});

	it("ignores registrants who are not seated", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const waiting = await insertUser(t, "venter@example.com");
		await insertStudent(t, waiting._id);
		await insertRegistration(t, eventId, waiting._id, "waitlist");
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");

		const info = await asUser(t, internalUser).query(queries.getRegistrantsInfo, {
			eventIdentifier: eventId,
		});

		expect(info).toEqual({});
	});

	it("files a registrant without a student record as unknown", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "ikkestudent@example.com");
		await insertRegistration(t, eventId, attendee._id, "registered");
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");

		const info = await asUser(t, internalUser).query(queries.getRegistrantsInfo, {
			eventIdentifier: eventId,
		});

		expect(info).toEqual({ [toBase64("Ukjent")]: { [toBase64("Ukjent")]: { "-1": 1 } } });
	});

	it("refuses a plain student", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).query(queries.getRegistrantsInfo, { eventIdentifier: eventId }),
		);

		expect(message).toContain("Unauthorized");
	});

	it("refuses an event organizer who holds no internal role", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const message = await refusalMessageFrom(
			asUser(t, organizer).query(queries.getRegistrantsInfo, { eventIdentifier: eventId }),
		);

		expect(message).toContain("Unauthorized");
	});
});
