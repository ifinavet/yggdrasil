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

const DETAILS = {
	title: "Bedriftspresentasjon med Fjordkode",
	teaser: "Bli med på presentasjon og kodeoppgave.",
	description: "Presentasjon, kodeoppgave i grupper og mat etterpå.",
	startTime: "16:15",
	registrationOpens: Date.parse("2027-01-26T11:00:00Z"),
	location: "Simula, Ole-Johan Dahls hus",
	food: "Pizza",
	language: "Norsk",
	ageRestriction: "Ingen",
};

async function eventSetup() {
	const { t, companyId } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	const responsible = await insertUser(t, "emil@ifinavet.no");
	await grantRole(t, responsible._id, "internal");
	const semesterId = await insertSemester(t);
	const applicationId = await insertApplication(t, semesterId, {
		status: "confirmed",
		assignedDate: "2027-02-09",
		companyId,
		responsibleUserId: responsible._id,
		maxStudents: 35,
	});
	return { t, companyId, semesterId, applicationId, responsible, editor: asUser(t, editorUser) };
}

async function organizersOf(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) =>
		ctx.db
			.query("eventOrganizers")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect(),
	);
}

describe("createEvent", () => {
	it("creates an unpublished event for the confirmed date and links it", async () => {
		const { t, companyId, applicationId, responsible, editor } = await eventSetup();

		const eventId = await editor.mutation(createEvent, { applicationId, ...DETAILS });

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event).toMatchObject({
			title: DETAILS.title,
			eventStart: Date.parse("2027-02-09T15:15:00Z"),
			participationLimit: 35,
			hostingCompany: companyId,
			published: false,
			externalEvent: false,
		});
		expect(event?.slug).toMatch(/^v27-bedriftspresentasjon-med-fjordkode-/);
		expect(event?.formId).toBeDefined();
		expect((await organizersOf(t, eventId)).map((row) => [row.userId, row.role])).toEqual([
			[responsible._id, "hovedansvarlig"],
		]);
		expect((await applicationById(t, applicationId)).eventId).toBe(eventId);
		expect((await activityFor(t, applicationId)).map((row) => row.type)).toEqual(["event_linked"]);
	});

	it("lets the editor change the number of seats", async () => {
		const { t, applicationId, editor } = await eventSetup();

		const eventId = await editor.mutation(createEvent, {
			applicationId,
			...DETAILS,
			participationLimit: 30,
		});

		expect((await t.run((ctx) => ctx.db.get(eventId)))?.participationLimit).toBe(30);
	});

	it.each([
		[
			"an application that is not confirmed",
			{ status: "offer_sent" as const },
			"Bare bekreftede søknader kan få et arrangement.",
		],
		[
			"an application without a company profile",
			{ companyId: undefined },
			"Koble søknaden til en bedriftsprofil først.",
		],
	])("refuses %s", async (_case, overrides, expected) => {
		const { t, applicationId, editor } = await eventSetup();
		await t.run((ctx) => ctx.db.patch(applicationId, overrides));

		expect(
			await refusalMessageFrom(editor.mutation(createEvent, { applicationId, ...DETAILS })),
		).toBe(expected);
	});

	it("refuses a second event, but allows a new one if the first was deleted", async () => {
		const { t, applicationId, editor } = await eventSetup();
		const first = await editor.mutation(createEvent, { applicationId, ...DETAILS });

		expect(
			await refusalMessageFrom(editor.mutation(createEvent, { applicationId, ...DETAILS })),
		).toBe("Søknaden har allerede et arrangement.");

		await t.run((ctx) => ctx.db.delete(first));
		const second = await editor.mutation(createEvent, { applicationId, ...DETAILS });
		expect((await applicationById(t, applicationId)).eventId).toBe(second);
	});

	it("refuses a start time that is not HH:mm", async () => {
		const { applicationId, editor } = await eventSetup();

		expect(
			await refusalMessageFrom(
				editor.mutation(createEvent, { applicationId, ...DETAILS, startTime: "kl 16" }),
			),
		).toBe("Skriv starttiden som TT:MM.");
	});

	it("creates an event without organizers when nobody is responsible", async () => {
		const { t, applicationId, editor } = await eventSetup();
		await t.run((ctx) => ctx.db.patch(applicationId, { responsibleUserId: undefined }));

		const eventId = await editor.mutation(createEvent, { applicationId, ...DETAILS });
		expect(await organizersOf(t, eventId)).toEqual([]);
	});
});

describe("events.create after extracting insertEventWithOrganizers", () => {
	it("still creates the event with a feedback form, slug and organizers", async () => {
		const { t, companyId, responsible } = await eventSetup();
		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");
		const { startTime: _startTime, ...details } = DETAILS;

		await asUser(t, member).mutation(api.events.mutations.create, {
			...details,
			eventStart: Date.parse("2027-09-14T14:15:00Z"),
			participationLimit: 40,
			externalEvent: false,
			hostingCompany: companyId,
			published: false,
			organizers: [{ userId: responsible._id, role: "medhjelper" }],
		});

		const [event] = await t.run((ctx) =>
			ctx.db
				.query("events")
				.withIndex("by_eventStart", (q) => q.eq("eventStart", Date.parse("2027-09-14T14:15:00Z")))
				.collect(),
		);
		expect(event?.slug).toMatch(/^h27-/);
		expect(event?.formId).toBeDefined();
		expect((await organizersOf(t, event?._id as Id<"events">)).map((row) => row.role)).toEqual([
			"medhjelper",
		]);
	});
});
