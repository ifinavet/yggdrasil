/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertExternalPage,
	insertForm,
	insertFormResponse,
	insertInternal,
	insertJobListing,
	insertOrganizer,
	insertRegistration,
	insertResource,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../test/fixtures";
import { api } from "./_generated/api";

async function insertInternalUser(t: TestBackend, email = "intern@example.com") {
	const internalUser = await insertUser(t, email);
	await grantRole(t, internalUser._id, "internal");
	return internalUser;
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
		const internalUser = await insertInternalUser(t);

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
		}
		expect(serialized).not.toContain("email");
		expect(serialized).not.toContain("firstName");
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

describe("events.registrations.queries.getById", () => {
	async function backendWithRegistration() {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const owner = await insertUser(t, "eier@example.com");
		const registrationId = await insertRegistration(t, eventId, owner._id, "registered");

		return { t, eventId, owner, registrationId };
	}

	it("refuses a stranger", async () => {
		const { t, registrationId } = await backendWithRegistration();
		const stranger = await insertUser(t, "fremmed@example.com");

		const message = await refusalMessageFrom(
			asUser(t, stranger).query(api.events.registrations.queries.getById, { id: registrationId }),
		);

		expect(message).toContain("ikke tilgang");
	});

	it("lets the owner read their own registration", async () => {
		const { t, owner, registrationId } = await backendWithRegistration();

		const registration = await asUser(t, owner).query(api.events.registrations.queries.getById, {
			id: registrationId,
		});

		expect(registration._id).toBe(registrationId);
	});

	it("lets an event organizer read the registration", async () => {
		const { t, eventId, registrationId } = await backendWithRegistration();
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);

		const registration = await asUser(t, organizer).query(
			api.events.registrations.queries.getById,
			{ id: registrationId },
		);

		expect(registration._id).toBe(registrationId);
	});
});

describe("getEventRegistrationSummary on an unpublished event", () => {
	it("refuses a student and allows an internal", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { published: false });
		const student = await insertUser(t, "student@example.com");
		const internalUser = await insertInternalUser(t);

		const message = await refusalMessageFrom(
			asUser(t, student).query(api.events.registrations.queries.getEventRegistrationSummary, {
				eventIdentifier: eventId,
			}),
		);
		expect(message).toContain("ble ikke funnet");

		const summary = await asUser(t, internalUser).query(
			api.events.registrations.queries.getEventRegistrationSummary,
			{ eventIdentifier: eventId },
		);
		expect(summary.registeredCount).toBe(0);
	});
});

describe("forms.queries.getFormResponsesByFormId", () => {
	it("refuses a student and allows an internal", async () => {
		const { t } = await setup();
		const formId = await insertForm(t);
		await insertFormResponse(t, formId, { rating: 5 });
		const student = await insertUser(t, "student@example.com");
		const internalUser = await insertInternalUser(t);

		const message = await refusalMessageFrom(
			asUser(t, student).query(api.forms.queries.getFormResponsesByFormId, { formId }),
		);
		expect(message).toContain("Krever rollen: super-admin, admin, editor eller internal.");

		const responses = await asUser(t, internalUser).query(
			api.forms.queries.getFormResponsesByFormId,
			{ formId },
		);
		expect(responses).toHaveLength(1);
	});
});

describe("jobListings.queries.getAll", () => {
	async function backendWithHiddenListing() {
		const { t, companyId } = await setup();
		await insertJobListing(t, companyId, { title: "Publisert" });
		await insertJobListing(t, companyId, { title: "Upublisert", published: false });

		return { t };
	}

	it("hides an unpublished listing from anonymous callers", async () => {
		const { t } = await backendWithHiddenListing();

		const listings = await t.query(api.jobListings.queries.getAll, {});

		expect(listings.map((listing) => listing.title)).toEqual(["Publisert"]);
	});

	it("hides an unpublished listing from a student", async () => {
		const { t } = await backendWithHiddenListing();
		const student = await insertUser(t, "student@example.com");

		const listings = await asUser(t, student).query(api.jobListings.queries.getAll, {});

		expect(listings.map((listing) => listing.title)).toEqual(["Publisert"]);
	});

	it("shows an unpublished listing to an internal", async () => {
		const { t } = await backendWithHiddenListing();
		const internalUser = await insertInternalUser(t);

		const listings = await asUser(t, internalUser).query(api.jobListings.queries.getAll, {});

		expect(listings.map((listing) => listing.title).sort()).toEqual(["Publisert", "Upublisert"]);
	});

	it("gives a student the newest published listing when n is 1", async () => {
		const { t, companyId } = await setup();
		const day = 24 * 60 * 60 * 1000;
		await insertJobListing(t, companyId, {
			title: "Eldre publisert",
			deadline: Date.now() + day,
		});
		await insertJobListing(t, companyId, {
			title: "Nyere publisert",
			deadline: Date.now() + 2 * day,
		});
		await insertJobListing(t, companyId, {
			title: "Nyeste upublisert",
			deadline: Date.now() + 3 * day,
			published: false,
		});
		const student = await insertUser(t, "student@example.com");

		const listings = await asUser(t, student).query(api.jobListings.queries.getAll, { n: 1 });

		expect(listings.map((listing) => listing.title)).toEqual(["Nyere publisert"]);
	});
});

describe("jobListings.queries.getById", () => {
	it("refuses a student on an unpublished listing and returns it to an internal", async () => {
		const { t, companyId } = await setup();
		const listingId = await insertJobListing(t, companyId, { published: false });
		const student = await insertUser(t, "student@example.com");
		const internalUser = await insertInternalUser(t);

		const message = await refusalMessageFrom(
			asUser(t, student).query(api.jobListings.queries.getById, { id: listingId }),
		);
		expect(message).toContain("Stillingsannonsen ble ikke funnet.");

		const listing = await asUser(t, internalUser).query(api.jobListings.queries.getById, {
			id: listingId,
		});
		expect(listing._id).toBe(listingId);
	});
});

describe("pages queries hide unpublished content from anonymous callers", () => {
	it("leaves the unpublished bucket empty in getAllGroupedByTag", async () => {
		const { t } = await setup();
		await insertResource(t, "Publisert ressurs");
		await insertResource(t, "Upublisert ressurs", { published: false });

		const { groupedByTag, unpublishedResources } = await t.query(
			api.pages.queries.getAllGroupedByTag,
			{},
		);

		expect(unpublishedResources).toEqual([]);
		expect(groupedByTag.generelt.map((resource) => resource.title)).toEqual(["Publisert ressurs"]);
	});

	it("filters unpublished favorites out of getFavorites", async () => {
		const { t } = await setup();
		await insertResource(t, "Publisert favoritt", { favorite: true });
		await insertResource(t, "Upublisert favoritt", { favorite: true, published: false });

		const favorites = await t.query(api.pages.queries.getFavorites, {});

		expect(favorites.map((resource) => resource.title)).toEqual(["Publisert favoritt"]);
	});

	it("filters unpublished pages out of getAll", async () => {
		const { t } = await setup();
		await insertExternalPage(t, "publisert");
		await insertExternalPage(t, "upublisert", { published: false });

		const pages = await t.query(api.pages.queries.getAll, {});

		expect(pages.map((page) => page.identifier)).toEqual(["publisert"]);
	});
});

describe("pages.queries.getByIdentifier", () => {
	it("hides an unpublished page from anonymous callers", async () => {
		const { t } = await setup();
		await insertExternalPage(t, "om-oss", { published: false });

		const message = await refusalMessageFrom(
			t.query(api.pages.queries.getByIdentifier, { identifier: "om-oss" }),
		);

		expect(message).toContain("ble ikke funnet");
	});

	it("shows an unpublished page to an editor", async () => {
		const { t } = await setup();
		await insertExternalPage(t, "om-oss", { published: false });
		const editor = await insertUser(t, "editor@example.com");
		await grantRole(t, editor._id, "editor");

		const page = await asUser(t, editor).query(api.pages.queries.getByIdentifier, {
			identifier: "om-oss",
		});

		expect(page.identifier).toBe("om-oss");
	});
});
