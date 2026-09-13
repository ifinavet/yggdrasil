/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertInternal,
	insertOrganizer,
	insertRegistration,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../test/fixtures";
import { api } from "./_generated/api";

async function insertUnpublishedPage(t: TestBackend, identifier: string) {
	await t.run((ctx) =>
		ctx.db.insert("externalPages", {
			identifier,
			title: "Hemmelig side",
			content: "",
			published: false,
			updatedAt: Date.now(),
		}),
	);
}

describe("events.queries.getEvent", () => {
	it("hides an unpublished event from anonymous callers", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { published: false });

		const message = await refusalMessageFrom(
			t.query(api.events.queries.getEvent, { identifier: eventId }),
		);

		expect(message).toContain("ble ikke funnet");
	});

	it("shows an unpublished event to an internal user", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { published: false });
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");

		const event = await asUser(t, internalUser).query(api.events.queries.getEvent, {
			identifier: eventId,
		});

		expect(event._id).toBe(eventId);
	});
});

describe("events.registrations.queries.getEventRegistrationSummary", () => {
	it("returns counts and only the caller's own registration", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const caller = await insertUser(t, "meg@example.com");
		const ownRegistrationId = await insertRegistration(t, eventId, caller._id, "registered");
		const otherAttendee = await insertUser(t, "andre@example.com");
		await insertRegistration(t, eventId, otherAttendee._id, "registered");
		const waitlisted = await insertUser(t, "venteliste@example.com");
		await insertRegistration(t, eventId, waitlisted._id, "waitlist");

		const summary = await asUser(t, caller).query(
			api.events.registrations.queries.getEventRegistrationSummary,
			{ eventIdentifier: eventId },
		);

		expect(summary.registeredCount).toBe(2);
		expect(summary.waitlistCount).toBe(1);
		expect(summary.ownRegistration?._id).toBe(ownRegistrationId);

		const serialized = JSON.stringify(summary);
		for (const hidden of [otherAttendee, waitlisted]) {
			expect(serialized).not.toContain(hidden._id);
			expect(serialized).not.toContain(hidden.externalId);
		}
	});
});

describe("events.registrations.queries.getByEventId", () => {
	it("refuses a plain student", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).query(api.events.registrations.queries.getByEventId, {
				eventIdentifier: eventId,
			}),
		);

		expect(message).toContain("Bare arrangører eller administratorer");
	});

	it("lets an event organizer read the attendee list", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const attendee = await insertUser(t, "deltaker@example.com");
		await insertRegistration(t, eventId, attendee._id, "registered");
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const lists = await asUser(t, organizer).query(api.events.registrations.queries.getByEventId, {
			eventIdentifier: eventId,
		});

		expect(lists.registered).toHaveLength(1);
		expect(lists.registered[0].userEmail).toBe("deltaker@example.com");
	});
});

describe("users.organization.queries.getAllInternals", () => {
	it("refuses anonymous callers", async () => {
		const { t } = await setup();

		const message = await refusalMessageFrom(
			t.query(api.users.organization.queries.getAllInternals, {}),
		);

		expect(message).toContain("innlogget");
	});

	it("refuses an internal user", async () => {
		const { t } = await setup();
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");
		await insertInternal(t, internalUser._id);

		const message = await refusalMessageFrom(
			asUser(t, internalUser).query(api.users.organization.queries.getAllInternals, {}),
		);

		expect(message).toContain("admin");
	});

	it("lets an admin read the internals list", async () => {
		const { t } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const member = await insertUser(t, "intern@example.com");
		await insertInternal(t, member._id);

		const internals = await asUser(t, admin).query(
			api.users.organization.queries.getAllInternals,
			{},
		);

		expect(internals).toHaveLength(1);
		expect(internals[0].email).toBe("intern@example.com");
	});
});

describe("pages.queries.getByIdentifier", () => {
	it("hides an unpublished page from anonymous callers", async () => {
		const { t } = await setup();
		await insertUnpublishedPage(t, "om-oss");

		const message = await refusalMessageFrom(
			t.query(api.pages.queries.getByIdentifier, { identifier: "om-oss" }),
		);

		expect(message).toContain("ble ikke funnet");
	});

	it("shows an unpublished page to an editor", async () => {
		const { t } = await setup();
		await insertUnpublishedPage(t, "om-oss");
		const editor = await insertUser(t, "editor@example.com");
		await grantRole(t, editor._id, "editor");

		const page = await asUser(t, editor).query(api.pages.queries.getByIdentifier, {
			identifier: "om-oss",
		});

		expect(page.identifier).toBe("om-oss");
	});
});
