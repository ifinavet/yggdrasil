import { describe, expect, it } from "vitest";
import {
	activityFor,
	applicationById,
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertFoodItem,
	insertOrganizer,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { invoiceFor } from "../invoicing/schedule";

// An application with an event is one booking: the plan and the event editor change the same
// date and the same team.

// Tuesday 9 February 2027, 16:15 in Oslo.
const FEB_9 = Date.parse("2027-02-09T15:15:00Z");

async function bookedSetup() {
	const { t, companyId } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no", {
		firstName: "Kari",
		lastName: "Nordmann",
	});
	await grantRole(t, editorUser._id, "editor");
	const [lead, helper, other] = await Promise.all(
		["ola@ifinavet.no", "per@ifinavet.no", "siri@ifinavet.no"].map(async (email) => {
			const user = await insertUser(t, email);
			await grantRole(t, user._id, "internal");
			return user._id;
		}),
	);
	const semesterId = await insertSemester(t, { status: "open" });
	await t.run(async (ctx) => {
		for (const date of ["2027-02-09", "2027-02-11", "2027-02-16"]) {
			await ctx.db.insert("semesterDates", { semesterId, date });
		}
		await ctx.db.insert("semesterDates", { semesterId, date: "2027-02-18", closedLabel: "Ferie" });
	});
	const eventId = await insertEvent(t, companyId, {
		eventStart: FEB_9,
		registrationOpens: FEB_9 - 7 * 86_400_000,
		published: true,
	});
	await insertOrganizer(t, eventId, lead as Id<"users">);
	await insertOrganizer(t, eventId, helper as Id<"users">, "medhjelper");
	const applicationId = await insertApplication(t, semesterId, {
		status: "confirmed",
		assignedDate: "2027-02-09",
		responsibleUserId: lead,
		helperUserIds: [helper as Id<"users">],
		eventId,
	});
	return {
		t,
		companyId,
		semesterId,
		eventId,
		applicationId,
		editor: asUser(t, editorUser),
		lead: lead as Id<"users">,
		helper: helper as Id<"users">,
		other: other as Id<"users">,
	};
}

async function organizersOf(t: TestBackend, eventId: Id<"events">) {
	const organizers = await t.run((ctx) =>
		ctx.db
			.query("eventOrganizers")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect(),
	);
	return organizers
		.map(({ userId, role }) => ({ userId, role }))
		.sort((a, b) => a.userId.localeCompare(b.userId));
}

async function invoiceServiceAt(t: TestBackend, applicationId: Id<"companyApplications">) {
	const invoice = await t.run((ctx) =>
		invoiceFor(ctx, { kind: "companyApplication", applicationId }),
	);
	return invoice?.serviceAt;
}

async function saveEvent(
	booked: Awaited<ReturnType<typeof bookedSetup>>,
	changes: {
		eventStart: number;
		organizers: { userId: Id<"users">; role: "hovedansvarlig" | "medhjelper" }[];
	},
) {
	const { t, companyId, eventId, editor } = booked;
	const event = await t.run((ctx) => ctx.db.get(eventId));
	if (!event) throw new Error("Expected the event.");
	return editor.mutation(api.events.mutations.update, {
		id: eventId,
		title: event.title,
		teaser: event.teaser,
		description: event.description,
		registrationOpens: event.registrationOpens,
		participationLimit: event.participationLimit,
		location: event.location,
		language: event.language,
		ageRestriction: event.ageRestriction,
		externalEvent: event.externalEvent,
		hostingCompany: companyId,
		published: event.published,
		foodItem: await insertFoodItem(t),
		...changes,
	});
}

describe("moving the date", () => {
	it("in the plan moves the event to the same time on the new day and keeps it confirmed", async () => {
		const booked = await bookedSetup();
		const { t, eventId, applicationId, editor } = booked;

		await editor.mutation(api.semesterPlanning.applications.mutations.assignDate, {
			applicationId,
			date: "2027-02-16",
		});

		const application = await applicationById(t, applicationId);
		expect([application.status, application.assignedDate, application.eventId]).toEqual([
			"confirmed",
			"2027-02-16",
			eventId,
		]);
		const moved = Date.parse("2027-02-16T15:15:00Z");
		expect((await t.run((ctx) => ctx.db.get(eventId)))?.eventStart).toBe(moved);
		expect(await invoiceServiceAt(t, applicationId)).toBe(moved);
		expect(await activityFor(t, applicationId)).toMatchObject([
			{ type: "date_assigned", date: "2027-02-16" },
		]);
	});

	it("in the event editor moves the application and its invoice", async () => {
		const booked = await bookedSetup();
		const { t, applicationId, lead, helper } = booked;
		const eventStart = Date.parse("2027-02-11T17:00:00Z");

		await saveEvent(booked, {
			eventStart,
			organizers: [
				{ userId: lead, role: "hovedansvarlig" },
				{ userId: helper, role: "medhjelper" },
			],
		});

		const application = await applicationById(t, applicationId);
		expect([application.status, application.assignedDate]).toEqual(["confirmed", "2027-02-11"]);
		expect(await invoiceServiceAt(t, applicationId)).toBe(eventStart);
	});

	it("in the event editor is refused on a day the plan cannot give, and saves nothing", async () => {
		const booked = await bookedSetup();
		const { t, semesterId, eventId, applicationId, lead } = booked;
		await insertApplication(t, semesterId, {
			status: "offer_sent",
			assignedDate: "2027-02-16",
			registry: {
				name: "ANNEN AS",
				organizationForm: { code: "AS", description: "Aksjeselskap" },
				fetchedAt: 0,
			},
		});
		const organizers = [{ userId: lead, role: "hovedansvarlig" as const }];

		for (const [day, reason] of [
			["2027-02-16", "Datoen er allerede gitt til ANNEN AS."],
			["2027-02-18", "Datoen er stengt: Ferie."],
			["2027-02-10", "Datoen finnes ikke i semesteret."],
		] as const) {
			expect(
				await refusalMessageFrom(
					saveEvent(booked, { eventStart: Date.parse(`${day}T15:15:00Z`), organizers }),
				),
			).toBe(
				`Arrangementet er bedriftspresentasjonen til FJORDKODE AS i semesterplanen, og datoen må passe der. ${reason}`,
			);
		}
		expect((await t.run((ctx) => ctx.db.get(eventId)))?.eventStart).toBe(FEB_9);
		expect((await applicationById(t, applicationId)).assignedDate).toBe("2027-02-09");
	});

	it("only changes the time when the event stays on its day", async () => {
		const booked = await bookedSetup();
		const { t, applicationId, lead } = booked;

		await saveEvent(booked, {
			eventStart: Date.parse("2027-02-09T11:00:00Z"),
			organizers: [{ userId: lead, role: "hovedansvarlig" }],
		});

		expect((await applicationById(t, applicationId)).assignedDate).toBe("2027-02-09");
		expect(await activityFor(t, applicationId)).toEqual([]);
	});
});

describe("changing the team", () => {
	it("in the plan changes the event's organizers, and keeps another hovedansvarlig", async () => {
		const booked = await bookedSetup();
		const { t, eventId, applicationId, editor, lead, helper, other } = booked;
		const extraLead = await insertUser(t, "ekstra@ifinavet.no");
		await insertOrganizer(t, eventId, extraLead._id);
		const update = api.semesterPlanning.applications.mutations.updatePlanningDetails;

		await editor.mutation(update, { applicationId, responsibleUserId: other });
		await editor.mutation(update, { applicationId, helperUserIds: [lead] });

		expect(await organizersOf(t, eventId)).toEqual(
			[
				{ userId: other, role: "hovedansvarlig" },
				{ userId: extraLead._id, role: "hovedansvarlig" },
				{ userId: lead, role: "medhjelper" },
			].sort((a, b) => a.userId.localeCompare(b.userId)),
		);
		expect(await organizersOf(t, eventId)).not.toContainEqual(
			expect.objectContaining({ userId: helper }),
		);
		const { application } = await editor.query(api.semesterPlanning.applications.queries.get, {
			applicationId,
		});
		expect([application.responsibleUserId, application.helperUserIds]).toEqual([other, [lead]]);
		const [row] = await editor.query(api.semesterPlanning.applications.queries.getPlan, {
			semesterId: booked.semesterId,
		});
		expect([row?.responsibleUserId, row?.helpers.map(({ userId }) => userId)]).toEqual([
			other,
			[lead],
		]);
	});

	it("in the event editor shows in the plan and on the application", async () => {
		const booked = await bookedSetup();
		const { t, applicationId, editor, lead, other } = booked;

		await saveEvent(booked, {
			eventStart: FEB_9,
			organizers: [
				{ userId: other, role: "hovedansvarlig" },
				{ userId: lead, role: "medhjelper" },
			],
		});

		const application = await applicationById(t, applicationId);
		expect([application.responsibleUserId, application.helperUserIds]).toEqual([other, [lead]]);
		const [row] = await editor.query(api.semesterPlanning.applications.queries.getPlan, {
			semesterId: booked.semesterId,
		});
		expect(row?.responsibleUserId).toBe(other);
	});

	it("still refuses someone who is not an internal member", async () => {
		const { t, applicationId, editor } = await bookedSetup();
		const outsider = await insertUser(t, "ute@example.com");

		expect(
			await refusalMessageFrom(
				editor.mutation(api.semesterPlanning.applications.mutations.updatePlanningDetails, {
					applicationId,
					responsibleUserId: outsider._id,
				}),
			),
		).toBe("Kontaktpersonen fra Navet må være et internt medlem.");
	});
});
