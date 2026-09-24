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

type Organizer = { userId: Id<"users">; role: "hovedansvarlig" | "medhjelper" };

/** What Bifrost's event form sends for the application's date, 9 February 2027 at 16:15. */
function details(companyId: Id<"companies">, organizers: Organizer[]) {
	return {
		title: "Bedriftspresentasjon med Fjordkode",
		teaser: "Bli med på presentasjon og kodeoppgave.",
		description: "Presentasjon, kodeoppgave i grupper og mat etterpå.",
		eventStart: Date.parse("2027-02-09T15:15:00Z"),
		registrationOpens: Date.parse("2027-01-26T11:00:00Z"),
		participationLimit: 35,
		location: "Simula, Ole-Johan Dahls hus",
		food: "Pizza",
		language: "Norsk",
		ageRestriction: "Ingen",
		hostingCompany: companyId,
		published: false,
		organizers,
	};
}

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
		// The org.nr. of the fixture's company profile.
		orgNumber: "123456789",
		responsibleUserId: responsible._id,
		maxStudents: 35,
	});
	const form = details(companyId, [{ userId: responsible._id, role: "hovedansvarlig" }]);
	return { t, companyId, applicationId, responsible, form, editor: asUser(t, editorUser) };
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
	it("creates the event from the form and links it and the company profile", async () => {
		const { t, companyId, applicationId, responsible, form, editor } = await eventSetup();
		const helper = await insertUser(t, "helper@ifinavet.no");

		const eventId = await editor.mutation(createEvent, {
			applicationId,
			...form,
			organizers: [...form.organizers, { userId: helper._id, role: "medhjelper" }],
		});

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event).toMatchObject({
			title: form.title,
			eventStart: form.eventStart,
			participationLimit: 35,
			hostingCompany: companyId,
			published: false,
			externalEvent: false,
		});
		expect(event?.slug).toMatch(/^v27-bedriftspresentasjon-med-fjordkode-/);
		expect(event?.formId).toBeDefined();
		expect((await organizersOf(t, eventId)).map((row) => [row.userId, row.role])).toEqual([
			[responsible._id, "hovedansvarlig"],
			[helper._id, "medhjelper"],
		]);
		expect(await applicationById(t, applicationId)).toMatchObject({ eventId, companyId });
		expect((await activityFor(t, applicationId)).map((row) => row.type)).toEqual(["event_linked"]);
	});

	it("refuses a hosting company with another org.nr. than the application", async () => {
		const { t, companyId, applicationId, form, editor } = await eventSetup();
		const otherId = await t.run(async (ctx) => {
			const fixture = await ctx.db.get(companyId);
			if (!fixture) throw new Error("Expected the fixture's company.");
			return ctx.db.insert("companies", {
				orgNumber: 924773189,
				name: "Fjordkode AS",
				description: "",
				mainSponsor: false,
				logo: fixture.logo,
			});
		});

		expect(
			await refusalMessageFrom(
				editor.mutation(createEvent, { applicationId, ...form, hostingCompany: otherId }),
			),
		).toBe("Bedriften må ha samme organisasjonsnummer som søknaden.");
		expect((await applicationById(t, applicationId)).eventId).toBeUndefined();
	});

	it("refuses an application that is not confirmed", async () => {
		const { t, applicationId, form, editor } = await eventSetup();
		await t.run((ctx) => ctx.db.patch(applicationId, { status: "offer_sent" }));

		expect(await refusalMessageFrom(editor.mutation(createEvent, { applicationId, ...form }))).toBe(
			"Bare bekreftede søknader kan få et arrangement.",
		);
	});

	it("refuses an event on another day than the application's date", async () => {
		const { applicationId, form, editor } = await eventSetup();

		expect(
			await refusalMessageFrom(
				editor.mutation(createEvent, {
					applicationId,
					...form,
					eventStart: Date.parse("2027-02-11T15:15:00Z"),
				}),
			),
		).toBe("Arrangementet må være tirsdag 9. februar 2027, datoen bedriften har fått.");
	});

	it("refuses a second event, but allows a new one if the first was deleted", async () => {
		const { t, applicationId, form, editor } = await eventSetup();
		const first = await editor.mutation(createEvent, { applicationId, ...form });

		expect(await refusalMessageFrom(editor.mutation(createEvent, { applicationId, ...form }))).toBe(
			"Søknaden har allerede et arrangement.",
		);

		await t.run((ctx) => ctx.db.delete(first));
		const second = await editor.mutation(createEvent, { applicationId, ...form });
		expect((await applicationById(t, applicationId)).eventId).toBe(second);
	});
});
