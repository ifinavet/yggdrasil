import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertFoodItem,
	insertSemester,
	insertUser,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { placeEventInPlan } from "./helper";

// Autumn 2026: 18 August to 26 November.
const AUTUMN = {
	year: 2026,
	term: "autumn",
	firstDate: "2026-08-18",
	lastDate: "2026-11-26",
	applicationDeadline: "2026-06-01",
	status: "closed",
} as const;

// Tuesday 29 September 2026 and Tuesday 6 October 2026, 16:15 in Oslo.
const SEPTEMBER_29 = Date.parse("2026-09-29T14:15:00Z");
const OCTOBER_6 = Date.parse("2026-10-06T14:15:00Z");
// After the autumn period.
const DECEMBER_1 = Date.parse("2026-12-01T15:15:00Z");
// Tuesday 9 February 2027, in spring 2027.
const FEBRUARY_9 = Date.parse("2027-02-09T15:15:00Z");

async function autoSetup() {
	const { t, companyId } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	return { t, companyId, editorUser, editor: asUser(t, editorUser) };
}

async function planRowsOf(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) =>
		ctx.db
			.query("semesterPlanEvents")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect(),
	);
}

async function eventArgs(t: TestBackend, companyId: Id<"companies">, eventStart: number) {
	return {
		title: "Bedriftspresentasjon",
		teaser: "",
		description: "",
		eventStart,
		registrationOpens: eventStart - 7 * 86_400_000,
		participationLimit: 40,
		location: "Store auditorium",
		foodItem: await insertFoodItem(t),
		language: "Norsk",
		ageRestriction: "",
		externalEvent: false,
		hostingCompany: companyId,
		published: false,
		organizers: [],
	};
}

async function findEventByStart(t: TestBackend, eventStart: number) {
	const event = await t.run((ctx) =>
		ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) => q.eq("eventStart", eventStart))
			.first(),
	);
	if (!event) throw new Error("Expected the event to exist.");
	return event._id;
}

describe("importPendingCalendars", () => {
	const importPending = internal.semesterPlanning.planEvents.mutations.importPendingCalendars;

	it("puts the calendar into each semester with a period once, also a closed one", async () => {
		const { t, companyId } = await autoSetup();
		const semesterId = await insertSemester(t, AUTUMN);
		await insertSemester(t, {
			year: 2027,
			term: "autumn",
			firstDate: undefined,
			lastDate: undefined,
		});
		const inPeriod = await insertEvent(t, companyId, { eventStart: SEPTEMBER_29 });
		const linked = await insertEvent(t, companyId, { eventStart: OCTOBER_6 });
		await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2026-10-06",
			eventId: linked,
		});
		await insertEvent(t, companyId, { eventStart: DECEMBER_1 });

		expect(await t.mutation(importPending, {})).toEqual({ semesters: 1, added: 1 });

		const [row] = await planRowsOf(t, inPeriod);
		expect(row).toMatchObject({ semesterId });
		expect(row?.addedBy).toBeUndefined();
		expect(await planRowsOf(t, linked)).toEqual([]);
		const semester = await t.run((ctx) => ctx.db.get(semesterId));
		expect(semester?.calendarImportedAt).toEqual(expect.any(Number));
	});

	it("runs once per semester, so an event taken out of the plan stays out", async () => {
		const { t, companyId } = await autoSetup();
		await insertSemester(t, AUTUMN);
		const eventId = await insertEvent(t, companyId, { eventStart: SEPTEMBER_29 });

		await t.mutation(importPending, {});
		const [row] = await planRowsOf(t, eventId);
		await t.run((ctx) => ctx.db.delete(row?._id as Id<"semesterPlanEvents">));

		expect(await t.mutation(importPending, {})).toEqual({ semesters: 0, added: 0 });
		expect(await planRowsOf(t, eventId)).toEqual([]);
	});
});

describe("setRange imports the calendar the first time", () => {
	it("puts the events in the new period into the plan", async () => {
		const { t, companyId, editor, editorUser } = await autoSetup();
		const semesterId = await insertSemester(t, {
			...AUTUMN,
			status: "draft",
			firstDate: undefined,
			lastDate: undefined,
		});
		const eventId = await insertEvent(t, companyId, { eventStart: SEPTEMBER_29 });

		await editor.mutation(api.semesterPlanning.semesters.mutations.setRange, {
			semesterId,
			firstDate: AUTUMN.firstDate,
			lastDate: AUTUMN.lastDate,
		});

		expect(await planRowsOf(t, eventId)).toMatchObject([{ semesterId, addedBy: editorUser._id }]);
	});
});

describe("events follow their date into the plan", () => {
	it("puts a new event in the plan of the semester it is in", async () => {
		const { t, companyId, editor } = await autoSetup();
		const semesterId = await insertSemester(t, AUTUMN);

		await editor.mutation(api.events.mutations.create, await eventArgs(t, companyId, SEPTEMBER_29));

		const rows = await planRowsOf(t, await findEventByStart(t, SEPTEMBER_29));
		expect(rows).toMatchObject([{ semesterId }]);
		expect(rows[0]?.addedBy).toBeUndefined();
	});

	it("leaves a new event outside every semester out of the plans", async () => {
		const { t, companyId, editor } = await autoSetup();
		await insertSemester(t, AUTUMN);

		await editor.mutation(api.events.mutations.create, await eventArgs(t, companyId, DECEMBER_1));

		expect(await planRowsOf(t, await findEventByStart(t, DECEMBER_1))).toEqual([]);
	});

	it("moves an event's plan row with it to another semester, and out when none holds it", async () => {
		const { t, companyId, editor } = await autoSetup();
		const autumn = await insertSemester(t, AUTUMN);
		const spring = await insertSemester(t, {
			year: 2027,
			term: "spring",
			firstDate: "2027-01-19",
			lastDate: "2027-05-06",
		});
		const eventId = await insertEvent(t, companyId, { eventStart: SEPTEMBER_29 });
		await t.run((ctx) => ctx.db.insert("semesterPlanEvents", { semesterId: autumn, eventId }));

		await editor.mutation(api.events.mutations.update, {
			id: eventId,
			...(await eventArgs(t, companyId, FEBRUARY_9)),
		});
		expect(await planRowsOf(t, eventId)).toMatchObject([{ semesterId: spring }]);

		await editor.mutation(api.events.mutations.update, {
			id: eventId,
			...(await eventArgs(t, companyId, DECEMBER_1)),
		});
		expect(await planRowsOf(t, eventId)).toEqual([]);
	});

	it("puts an event moved into a semester in its plan", async () => {
		const { t, companyId, editor } = await autoSetup();
		const semesterId = await insertSemester(t, AUTUMN);
		const eventId = await insertEvent(t, companyId, { eventStart: DECEMBER_1 });

		await editor.mutation(api.events.mutations.update, {
			id: eventId,
			...(await eventArgs(t, companyId, SEPTEMBER_29)),
		});

		expect(await planRowsOf(t, eventId)).toMatchObject([{ semesterId }]);
	});

	it("keeps an event taken out of the plan out when it is edited in the same semester", async () => {
		const { t, companyId, editor } = await autoSetup();
		await insertSemester(t, AUTUMN);
		const eventId = await insertEvent(t, companyId, { eventStart: SEPTEMBER_29 });

		await editor.mutation(api.events.mutations.update, {
			id: eventId,
			...(await eventArgs(t, companyId, OCTOBER_6)),
		});

		expect(await planRowsOf(t, eventId)).toEqual([]);
	});

	it("leaves an event made from an application to the application", async () => {
		const { t, companyId } = await autoSetup();
		const semesterId = await insertSemester(t, AUTUMN);
		const eventId = await insertEvent(t, companyId, { eventStart: SEPTEMBER_29 });
		await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2026-09-29",
			eventId,
		});

		await t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			if (event) await placeEventInPlan(ctx, event);
		});

		expect(await planRowsOf(t, eventId)).toEqual([]);
	});
});
