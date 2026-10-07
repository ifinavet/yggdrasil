import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertOrganizer,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const mutations = api.semesterPlanning.planEvents.mutations;
const queries = api.semesterPlanning.planEvents.queries;

// Autumn 2026: 18 August to 26 November.
const AUTUMN = {
	year: 2026,
	term: "autumn",
	firstDate: "2026-08-18",
	lastDate: "2026-11-26",
	applicationDeadline: "2026-06-01",
	status: "draft",
} as const;

async function planSetup() {
	const { t, companyId } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no", {
		firstName: "Kari",
		lastName: "Nordmann",
	});
	await grantRole(t, editorUser._id, "editor");
	const member = await insertUser(t, "ola@ifinavet.no", { firstName: "Ola", lastName: "Hansen" });
	await grantRole(t, member._id, "internal");
	const semesterId = await insertSemester(t, AUTUMN);
	return { t, companyId, semesterId, editorUser, editor: asUser(t, editorUser), member };
}

async function planEventsOf(t: TestBackend, semesterId: Id<"semesters">) {
	return t.run((ctx) =>
		ctx.db
			.query("semesterPlanEvents")
			.withIndex("by_semesterId", (q) => q.eq("semesterId", semesterId))
			.collect(),
	);
}

async function semesterWithoutDates(t: TestBackend) {
	return t.run((ctx) =>
		ctx.db.insert("semesters", { year: 2027, term: "autumn", status: "draft" }),
	);
}

// Tuesday 29 September 2026, 16:15 in Oslo.
const TUESDAY_START = Date.parse("2026-09-29T14:15:00Z");
// Wednesday 30 September 2026.
const WEDNESDAY_START = Date.parse("2026-09-30T14:15:00Z");

describe("addEvent", () => {
	it("puts an event in the plan on the Oslo day it starts", async () => {
		const { t, companyId, semesterId, editor, editorUser, member } = await planSetup();
		const eventId = await insertEvent(t, companyId, {
			title: "Bedpres med Testbedrift",
			eventStart: TUESDAY_START,
			published: false,
		});
		await insertOrganizer(t, eventId, member._id);

		await editor.mutation(mutations.addEvent, { semesterId, eventId });

		expect(await planEventsOf(t, semesterId)).toMatchObject([{ eventId, addedBy: editorUser._id }]);
		const [row] = await asUser(t, member).query(queries.listForSemester, { semesterId });
		expect(row).toMatchObject({
			eventId,
			date: "2026-09-29",
			title: "Bedpres med Testbedrift",
			companyName: "Testbedrift",
			published: false,
			participationLimit: 10,
			responsibleUserId: member._id,
			responsibleName: "Ola Hansen",
			helpers: [],
		});
	});

	it("allows a date an application or another event already holds; the plan shows both", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		await insertApplication(t, semesterId, { status: "confirmed", assignedDate: "2026-09-29" });
		const first = await insertEvent(t, companyId, { eventStart: TUESDAY_START });
		const second = await insertEvent(t, companyId, { eventStart: TUESDAY_START + 3_600_000 });

		await editor.mutation(mutations.addEvent, { semesterId, eventId: first });
		await editor.mutation(mutations.addEvent, { semesterId, eventId: second });

		expect(await planEventsOf(t, semesterId)).toHaveLength(2);
	});

	it("uses the Oslo day at the ends of the period", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		// 26 November 23:30 in Oslo is the last day; 27 November 00:30 in Oslo is outside.
		const inside = await insertEvent(t, companyId, {
			eventStart: Date.parse("2026-11-26T22:30:00Z"),
		});
		const outside = await insertEvent(t, companyId, {
			eventStart: Date.parse("2026-11-26T23:30:00Z"),
		});

		await editor.mutation(mutations.addEvent, { semesterId, eventId: inside });
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.addEvent, { semesterId, eventId: outside }),
			),
		).toBe("Arrangementet er ikke i semesterets periode.");
		expect(await editor.query(queries.candidates, { semesterId })).toEqual([]);
	});

	it("refuses an event outside the semester's period", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: Date.parse("2027-02-09T15:15:00Z"),
		});

		expect(
			await refusalMessageFrom(editor.mutation(mutations.addEvent, { semesterId, eventId })),
		).toBe("Arrangementet er ikke i semesterets periode.");
	});

	it("refuses an event that is already in a plan, by hand or through an application", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		const byHand = await insertEvent(t, companyId, { eventStart: TUESDAY_START });
		await editor.mutation(mutations.addEvent, { semesterId, eventId: byHand });
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.addEvent, { semesterId, eventId: byHand }),
			),
		).toBe("Arrangementet er allerede i en semesterplan.");

		const fromApplication = await insertEvent(t, companyId, { eventStart: WEDNESDAY_START });
		await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2026-09-30",
			eventId: fromApplication,
		});
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.addEvent, { semesterId, eventId: fromApplication }),
			),
		).toBe("Arrangementet er allerede i en semesterplan.");
	});

	it("refuses a closed semester and a semester without dates", async () => {
		const { t, companyId, editor } = await planSetup();
		const eventId = await insertEvent(t, companyId, { eventStart: TUESDAY_START });

		const closed = await insertSemester(t, { ...AUTUMN, status: "closed" });
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.addEvent, { semesterId: closed, eventId }),
			),
		).toBe("Semesteret er stengt og kan ikke endres.");

		const noDates = await semesterWithoutDates(t);
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.addEvent, { semesterId: noDates, eventId }),
			),
		).toBe("Sett første og siste dato under Innstillinger først.");
	});

	it("requires an editor", async () => {
		const { t, companyId, semesterId, member } = await planSetup();
		const eventId = await insertEvent(t, companyId, { eventStart: TUESDAY_START });

		expect(
			await refusalMessageFrom(
				asUser(t, member).mutation(mutations.addEvent, { semesterId, eventId }),
			),
		).toContain("Unauthorized");
	});
});

describe("removeEvent", () => {
	it("takes the event out of the plan and keeps the event", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		const eventId = await insertEvent(t, companyId, { eventStart: TUESDAY_START });
		await editor.mutation(mutations.addEvent, { semesterId, eventId });
		const [planEvent] = await planEventsOf(t, semesterId);

		await editor.mutation(mutations.removeEvent, {
			planEventId: planEvent?._id as Id<"semesterPlanEvents">,
		});

		expect(await planEventsOf(t, semesterId)).toEqual([]);
		expect(await t.run((ctx) => ctx.db.get(eventId))).not.toBeNull();
	});

	it("refuses a row that is gone, and a closed semester", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		const eventId = await insertEvent(t, companyId, { eventStart: TUESDAY_START });
		await editor.mutation(mutations.addEvent, { semesterId, eventId });
		const [planEvent] = await planEventsOf(t, semesterId);
		const planEventId = planEvent?._id as Id<"semesterPlanEvents">;

		await editor.mutation(mutations.removeEvent, { planEventId });
		expect(await refusalMessageFrom(editor.mutation(mutations.removeEvent, { planEventId }))).toBe(
			"Arrangementet er ikke i planen.",
		);

		await editor.mutation(mutations.addEvent, { semesterId, eventId });
		const [again] = await planEventsOf(t, semesterId);
		await t.run((ctx) => ctx.db.patch(semesterId, { status: "closed" }));
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.removeEvent, {
					planEventId: again?._id as Id<"semesterPlanEvents">,
				}),
			),
		).toBe("Semesteret er stengt og kan ikke endres.");
	});
});

describe("importFromCalendar", () => {
	it("links every event in the period that is not in a plan yet, on any weekday, published or not", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		const tuesday = await insertEvent(t, companyId, { eventStart: TUESDAY_START });
		const wednesday = await insertEvent(t, companyId, {
			eventStart: WEDNESDAY_START,
			published: false,
		});
		const linked = await insertEvent(t, companyId, {
			eventStart: Date.parse("2026-10-06T14:15:00Z"),
		});
		await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2026-10-06",
			eventId: linked,
		});
		await insertEvent(t, companyId, { eventStart: Date.parse("2026-12-01T14:15:00Z") });
		await insertEvent(t, companyId, { eventStart: Date.parse("2026-08-17T14:15:00Z") });

		const result = await editor.mutation(mutations.importFromCalendar, { semesterId });

		expect(result).toEqual({ added: 2, skipped: 1 });
		expect((await planEventsOf(t, semesterId)).map((row) => row.eventId).sort()).toEqual(
			[tuesday, wednesday].sort(),
		);
	});

	it("is idempotent", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		await insertEvent(t, companyId, { eventStart: TUESDAY_START });

		await editor.mutation(mutations.importFromCalendar, { semesterId });
		const second = await editor.mutation(mutations.importFromCalendar, { semesterId });

		expect(second).toEqual({ added: 0, skipped: 1 });
		expect(await planEventsOf(t, semesterId)).toHaveLength(1);
	});

	it("refuses a semester without dates", async () => {
		const { t, editor } = await planSetup();
		const noDates = await semesterWithoutDates(t);

		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.importFromCalendar, { semesterId: noDates }),
			),
		).toBe("Sett første og siste dato under Innstillinger først.");
	});

	it("requires an editor", async () => {
		const { t, semesterId, member } = await planSetup();

		expect(
			await refusalMessageFrom(
				asUser(t, member).mutation(mutations.importFromCalendar, { semesterId }),
			),
		).toContain("Unauthorized");
	});
});

describe("queries", () => {
	it("candidates lists events in the period that are in no plan, and nothing without dates", async () => {
		const { t, companyId, semesterId, editor } = await planSetup();
		const free = await insertEvent(t, companyId, { title: "Ledig", eventStart: WEDNESDAY_START });
		const inPlan = await insertEvent(t, companyId, { eventStart: TUESDAY_START });
		await editor.mutation(mutations.addEvent, { semesterId, eventId: inPlan });
		const fromApplication = await insertEvent(t, companyId, {
			eventStart: Date.parse("2026-10-06T14:15:00Z"),
		});
		await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2026-10-06",
			eventId: fromApplication,
		});
		await insertEvent(t, companyId, { eventStart: Date.parse("2027-02-09T15:15:00Z") });

		const candidates = await editor.query(queries.candidates, { semesterId });
		expect(candidates).toMatchObject([
			{ _id: free, date: "2026-09-30", title: "Ledig", companyName: "Testbedrift" },
		]);

		const noDates = await semesterWithoutDates(t);
		expect(await editor.query(queries.candidates, { semesterId: noDates })).toEqual([]);
	});

	it("listForSemester sorts by start, names the helpers, skips deleted events and needs an internal member", async () => {
		const { t, companyId, semesterId, editor, member } = await planSetup();
		const later = await insertEvent(t, companyId, { title: "Senere", eventStart: WEDNESDAY_START });
		const earlier = await insertEvent(t, companyId, { title: "Først", eventStart: TUESDAY_START });
		const gone = await insertEvent(t, companyId, { eventStart: TUESDAY_START + 60_000 });
		for (const eventId of [later, earlier, gone]) {
			await editor.mutation(mutations.addEvent, { semesterId, eventId });
		}
		await insertOrganizer(t, earlier, member._id, "medhjelper");
		await t.run((ctx) => ctx.db.delete(gone));

		const rows = await asUser(t, member).query(queries.listForSemester, { semesterId });
		expect(rows.map((row) => row.title)).toEqual(["Først", "Senere"]);
		expect(rows[0]?.helpers).toEqual([{ userId: member._id, name: "Ola Hansen" }]);

		expect(rows[1]).not.toHaveProperty("responsibleUserId");

		expect(await refusalMessageFrom(t.query(queries.listForSemester, { semesterId }))).toContain(
			"innlogget",
		);
		expect(
			await refusalMessageFrom(asUser(t, member).query(queries.candidates, { semesterId })),
		).toContain("Unauthorized");
	});

	it("listForSemester returns a row, never null fields, when the company or its logo is gone", async () => {
		const { t, companyId, semesterId, editor, member } = await planSetup();
		const eventId = await insertEvent(t, companyId, { eventStart: TUESDAY_START });
		await editor.mutation(mutations.addEvent, { semesterId, eventId });
		const noLogo = await t.run(async (ctx) => {
			const company = await ctx.db.get(companyId);
			if (!company) throw new Error("Expected the company.");
			await ctx.db.delete(company.logo);
			return company;
		});

		const [withoutLogo] = await asUser(t, member).query(queries.listForSemester, { semesterId });
		expect(withoutLogo).toMatchObject({ companyName: noLogo.name });
		expect(withoutLogo).not.toHaveProperty("logoUrl");

		await t.run((ctx) => ctx.db.delete(companyId));
		const [withoutCompany] = await asUser(t, member).query(queries.listForSemester, {
			semesterId,
		});
		expect(withoutCompany).toMatchObject({ eventId, companyName: "Ukjent" });
	});
});
