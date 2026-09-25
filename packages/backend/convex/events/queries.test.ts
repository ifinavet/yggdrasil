import { featureFlags } from "@workspace/shared/feature-flags";
import { afterEach, describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertRegistration,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
	type TestUser,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

const FALL_EVENT_START = new Date(2026, 8, 8, 16, 15).getTime();

async function insertOrganizerWithRole(
	t: TestBackend,
	eventId: Id<"events">,
	userId: Id<"users">,
	role: Doc<"eventOrganizers">["role"],
) {
	await t.run((ctx) => ctx.db.insert("eventOrganizers", { eventId, userId, role }));
}

async function insertCampaign(
	t: TestBackend,
	eventId: Id<"events">,
	status: Doc<"feedbackCampaigns">["status"],
) {
	return t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status,
			opensAt: FALL_EVENT_START,
			closesAt: FALL_EVENT_START,
			generation: 1,
		}),
	);
}

async function insertReport(
	t: TestBackend,
	eventId: Id<"events">,
	campaignId: Id<"feedbackCampaigns">,
	fields: Pick<Doc<"feedbackReports">, "status"> &
		Partial<Pick<Doc<"feedbackReports">, "deliveryStatus">>,
) {
	await t.run((ctx) =>
		ctx.db.insert("feedbackReports", {
			campaignId,
			eventId,
			eventTitle: "Testarrangement",
			eventStart: FALL_EVENT_START,
			companyName: "Testbedrift",
			recipientEmail: "bedrift@example.com",
			questions: [],
			totalResponses: 0,
			buildCursor: null,
			revision: 0,
			retentionAt: FALL_EVENT_START,
			...fields,
		}),
	);
}

async function internalUser(t: TestBackend, email: string) {
	const user = await insertUser(t, email);
	await grantRole(t, user._id, "internal");
	return user;
}

function overviewFor(t: TestBackend, user: TestUser) {
	return asUser(t, user).query(api.events.queries.getAll, { semester: "høst", year: 2026 });
}

describe("getAll", () => {
	afterEach(() => {
		featureFlags.huginFeedback.reportsEnabled = true;
	});

	it("refuses callers who are not signed in", async () => {
		const { t } = await setup();

		await expect(
			t.query(api.events.queries.getAll, { semester: "høst", year: 2026 }),
		).rejects.toThrow();
	});

	it("refuses signed-in users without an internal role", async () => {
		const { t } = await setup();
		const student = await insertUser(t, "student@example.com");

		expect(await refusalMessageFrom(overviewFor(t, student))).toContain("Unauthorized");
	});

	it("returns only events in the requested semester, sorted by start", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		await insertEvent(t, companyId, { title: "Senere", eventStart: FALL_EVENT_START + 1000 });
		await insertEvent(t, companyId, { title: "Først", eventStart: FALL_EVENT_START });
		await insertEvent(t, companyId, { title: "Vår", eventStart: new Date(2026, 2, 1).getTime() });

		const overview = await overviewFor(t, viewer);

		expect(overview.map((event) => event.title)).toEqual(["Først", "Senere"]);
	});

	it("includes unpublished events, company name and logo url", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		await insertEvent(t, companyId, { eventStart: FALL_EVENT_START, published: false });

		const [event] = await overviewFor(t, viewer);

		expect(event?.published).toBe(false);
		expect(event?.companyName).toBe("Testbedrift");
		expect(event?.companyLogoUrl).toEqual(expect.stringContaining("http"));
	});

	it("counts registered and pending as registered, and waitlist separately", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		const eventId = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START });
		const statuses = ["registered", "pending", "waitlist", "waitlist"] as const;
		for (const [index, status] of statuses.entries()) {
			const student = await insertUser(t, `student${index}@example.com`);
			await insertRegistration(t, eventId, student._id, status);
		}

		const [event] = await overviewFor(t, viewer);

		expect(event?.registeredCount).toBe(2);
		expect(event?.waitlistCount).toBe(2);
	});

	it("names the lead organizer and the viewer's own role", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		const lead = await insertUser(t, "lead@example.com", {
			firstName: "Daniel",
			lastName: "Brunvoll",
		});
		const helped = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START });
		const led = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START + 1 });
		const other = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START + 2 });
		await insertOrganizerWithRole(t, helped, lead._id, "hovedansvarlig");
		await insertOrganizerWithRole(t, helped, viewer._id, "medhjelper");
		await insertOrganizerWithRole(t, led, viewer._id, "hovedansvarlig");

		const overview = await overviewFor(t, viewer);
		const byId = new Map(overview.map((event) => [event._id, event]));

		expect(byId.get(helped)).toMatchObject({ leadName: "Daniel Brunvoll", myRole: "medhjelper" });
		expect(byId.get(led)).toMatchObject({ leadName: "Test Testesen", myRole: "hovedansvarlig" });
		expect(byId.get(other)).toMatchObject({ leadName: null, myRole: null });
	});

	it("reports open and scheduled feedback campaigns", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		const open = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START });
		const scheduled = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START + 1 });
		const closed = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START + 2 });
		await insertCampaign(t, open, "open");
		await insertCampaign(t, scheduled, "scheduled");
		await insertCampaign(t, closed, "closed");

		const overview = await overviewFor(t, viewer);

		expect(overview.map((event) => event.feedbackStatus)).toEqual(["open", "scheduled", null]);
	});

	it("shows draft and delivered reports to organizers", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		const draft = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START });
		const delivered = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START + 1 });
		for (const eventId of [draft, delivered]) {
			await insertOrganizerWithRole(t, eventId, viewer._id, "medhjelper");
		}
		await insertReport(t, draft, await insertCampaign(t, draft, "closed"), { status: "draft" });
		await insertReport(t, delivered, await insertCampaign(t, delivered, "closed"), {
			status: "approved",
			deliveryStatus: "delivered",
		});

		const overview = await overviewFor(t, viewer);

		expect(overview.map((event) => event.feedbackStatus)).toEqual(["draft", "delivered"]);
	});

	it("hides report status from internals who do not organize the event", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		const eventId = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START });
		await insertReport(t, eventId, await insertCampaign(t, eventId, "closed"), { status: "draft" });

		const [event] = await overviewFor(t, viewer);

		expect(event?.feedbackStatus).toBeNull();
	});

	it("shows report status to super-admins who do not organize the event", async () => {
		const { t, companyId } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "super-admin");
		const eventId = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START });
		await insertReport(t, eventId, await insertCampaign(t, eventId, "closed"), { status: "draft" });

		const [event] = await overviewFor(t, admin);

		expect(event?.feedbackStatus).toBe("draft");
	});

	it("hides report status when the report feature is off", async () => {
		const { t, companyId } = await setup();
		const viewer = await internalUser(t, "intern@example.com");
		const eventId = await insertEvent(t, companyId, { eventStart: FALL_EVENT_START });
		await insertOrganizerWithRole(t, eventId, viewer._id, "hovedansvarlig");
		await insertReport(t, eventId, await insertCampaign(t, eventId, "closed"), { status: "draft" });
		featureFlags.huginFeedback.reportsEnabled = false;

		const [event] = await overviewFor(t, viewer);

		expect(event?.feedbackStatus).toBeNull();
	});
});
