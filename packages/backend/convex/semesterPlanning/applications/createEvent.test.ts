import { describe, expect, it } from "vitest";
import {
	activityFor,
	applicationById,
	asUser,
	grantRole,
	insertApplication,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const createEvent = api.semesterPlanning.applications.mutations.createEvent;

async function eventSetup() {
	const { t, companyId } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	const responsible = await insertUser(t, "emil@ifinavet.no");
	await grantRole(t, responsible._id, "internal");
	const helper = await insertUser(t, "ida@ifinavet.no");
	await grantRole(t, helper._id, "internal");
	const semesterId = await insertSemester(t, { defaultEventStartTime: "16:15" });
	const applicationId = await insertApplication(t, semesterId, {
		status: "confirmed",
		assignedDate: "2027-02-09",
		// The org.nr. of the fixture's company profile, «Testbedrift».
		orgNumber: "123456789",
		responsibleUserId: responsible._id,
		helperUserIds: [helper._id],
		maxStudents: 35,
	});
	return {
		t,
		companyId,
		semesterId,
		applicationId,
		responsible,
		helper,
		editor: asUser(t, editorUser),
	};
}

async function organizersOf(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) =>
		ctx.db
			.query("eventOrganizers")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect(),
	);
}

async function eventById(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) => ctx.db.get(eventId));
}

describe("createEvent", () => {
	it("creates an unpublished draft on the date with the Navet team, and links it", async () => {
		const { t, companyId, applicationId, responsible, helper, editor } = await eventSetup();

		const eventId = await editor.mutation(createEvent, { applicationId });

		const event = await eventById(t, eventId);
		expect(event).toMatchObject({
			title: "Bedriftspresentasjon med Testbedrift",
			teaser: "Mer info kommer",
			location: "Mer info kommer",
			language: "Norsk",
			eventStart: Date.parse("2027-02-09T15:15:00Z"),
			registrationOpens: Date.parse("2027-02-09T15:15:00Z"),
			participationLimit: 35,
			hostingCompany: companyId,
			published: false,
			externalEvent: false,
		});
		expect(event?.slug).toMatch(/^v27-bedriftspresentasjon-med-testbedrift-/);
		expect((await organizersOf(t, eventId)).map((row) => [row.userId, row.role])).toEqual([
			[responsible._id, "hovedansvarlig"],
			[helper._id, "medhjelper"],
		]);
		expect((await applicationById(t, applicationId)).eventId).toBe(eventId);
		expect((await activityFor(t, applicationId)).map((row) => row.type)).toEqual(["event_linked"]);
	});

	it("is safe to run again, and moves an unpublished event to the application's date", async () => {
		const { t, applicationId, editor } = await eventSetup();
		const eventId = await editor.mutation(createEvent, { applicationId });

		expect(await editor.mutation(createEvent, { applicationId })).toBe(eventId);
		expect(await activityFor(t, applicationId)).toHaveLength(1);

		await t.run((ctx) => ctx.db.patch(applicationId, { assignedDate: "2027-02-11" }));
		await editor.mutation(createEvent, { applicationId });
		expect((await eventById(t, eventId))?.eventStart).toBe(Date.parse("2027-02-11T15:15:00Z"));

		await t.run(async (ctx) => {
			await ctx.db.patch(eventId, { published: true });
			await ctx.db.patch(applicationId, { assignedDate: "2027-02-16" });
		});
		expect(await editor.mutation(createEvent, { applicationId })).toBe(eventId);
		expect((await eventById(t, eventId))?.eventStart).toBe(Date.parse("2027-02-11T15:15:00Z"));
	});

	it("refuses until the semester has a start time for events", async () => {
		const { t, semesterId, applicationId, editor } = await eventSetup();
		await t.run((ctx) => ctx.db.patch(semesterId, { defaultEventStartTime: undefined }));

		expect(await refusalMessageFrom(editor.mutation(createEvent, { applicationId }))).toBe(
			"Sett starttid for arrangementer i innstillingene først.",
		);
	});

	it("refuses a company without a profile with the same org.nr.", async () => {
		const { t, applicationId, editor } = await eventSetup();
		await t.run((ctx) => ctx.db.patch(applicationId, { orgNumber: "924773189" }));

		expect(await refusalMessageFrom(editor.mutation(createEvent, { applicationId }))).toBe(
			"Fant ingen bedriftsprofil med samme organisasjonsnummer. Opprett bedriften først.",
		);
		expect((await applicationById(t, applicationId)).eventId).toBeUndefined();
	});

	it("refuses an application that is not confirmed", async () => {
		const { t, applicationId, editor } = await eventSetup();
		await t.run((ctx) => ctx.db.patch(applicationId, { status: "offer_sent" }));

		expect(await refusalMessageFrom(editor.mutation(createEvent, { applicationId }))).toBe(
			"Bare bekreftede søknader kan få et arrangement.",
		);
	});
});
