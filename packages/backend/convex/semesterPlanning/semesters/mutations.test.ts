import { MIDGARD_URL } from "@workspace/shared/constants";
import { describe, expect, it } from "vitest";
import {
	activityFor,
	applicationById,
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
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const mutations = api.semesterPlanning.semesters.mutations;
const queries = api.semesterPlanning.semesters.queries;

async function editorOf(t: TestBackend) {
	const editor = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editor._id, "editor");
	return asUser(t, editor);
}

async function datesOf(t: TestBackend, semesterId: Id<"semesters">) {
	return t.run((ctx) =>
		ctx.db
			.query("semesterDates")
			.withIndex("by_semesterId_and_date", (q) => q.eq("semesterId", semesterId))
			.collect(),
	);
}

async function semesterById(t: TestBackend, semesterId: Id<"semesters">) {
	const semester = await t.run((ctx) => ctx.db.get(semesterId));
	if (!semester) throw new Error("Expected the semester to exist.");
	return semester;
}

describe("create", () => {
	it("creates an empty draft that copies settings from the latest semester, but no dates", async () => {
		const { t } = await setup();
		await insertSemester(t, {
			year: 2026,
			term: "autumn",
			infoText: "Velkommen",
			termsUrl: `${MIDGARD_URL}/vilkar`,
			defaultEventStartTime: "16:15",
			status: "closed",
		});
		await insertSemester(t, { year: 2026, term: "spring", infoText: "Gammel", status: "closed" });

		const semesterId = await (await editorOf(t)).mutation(mutations.create, {
			year: 2027,
			term: "spring",
		});

		const semester = await semesterById(t, semesterId);
		expect(semester).toMatchObject({
			year: 2027,
			term: "spring",
			status: "draft",
			infoText: "Velkommen",
			termsUrl: `${MIDGARD_URL}/vilkar`,
			defaultEventStartTime: "16:15",
		});
		expect(semester.firstDate).toBeUndefined();
		expect(semester.lastDate).toBeUndefined();
		expect(semester.applicationDeadline).toBeUndefined();
		expect(await datesOf(t, semesterId)).toHaveLength(0);
	});

	it("refuses a semester that already exists", async () => {
		const { t } = await setup();
		await insertSemester(t, { year: 2027, term: "spring" });

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.create, { year: 2027, term: "spring" }),
		);
		expect(message).toBe("Våren 2027 finnes allerede.");
	});

	it("refuses internal members who are not editors", async () => {
		const { t } = await setup();
		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");

		const message = await refusalMessageFrom(
			asUser(t, member).mutation(mutations.create, { year: 2027, term: "spring" }),
		);
		expect(message).toContain("Unauthorized");
	});
});

describe("setRange", () => {
	it("generates the Tuesdays and Thursdays in the range", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, {
			status: "draft",
			firstDate: undefined,
			lastDate: undefined,
		});

		await (await editorOf(t)).mutation(mutations.setRange, {
			semesterId,
			firstDate: "2027-01-19",
			lastDate: "2027-05-06",
		});

		expect(await datesOf(t, semesterId)).toHaveLength(32);
		expect(await semesterById(t, semesterId)).toMatchObject({
			firstDate: "2027-01-19",
			lastDate: "2027-05-06",
		});
	});

	it("keeps closed labels on dates that stay in the range", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "draft" });
		const editor = await editorOf(t);
		await editor.mutation(mutations.setRange, {
			semesterId,
			firstDate: "2027-01-19",
			lastDate: "2027-02-11",
		});
		const kickoff = (await datesOf(t, semesterId)).find((date) => date.date === "2027-01-19");
		if (!kickoff) throw new Error("missing");
		await editor.mutation(mutations.setDateClosed, { dateId: kickoff._id, label: "Kickoff" });

		await editor.mutation(mutations.setRange, {
			semesterId,
			firstDate: "2027-01-19",
			lastDate: "2027-01-28",
		});

		const dates = await datesOf(t, semesterId);
		expect(dates.map((date) => [date.date, date.closedLabel])).toEqual([
			["2027-01-19", "Kickoff"],
			["2027-01-21", undefined],
			["2027-01-26", undefined],
			["2027-01-28", undefined],
		]);
	});

	it("refuses to remove a date that a company has been given", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "open" });
		const editor = await editorOf(t);
		await editor.mutation(mutations.setRange, {
			semesterId,
			firstDate: "2027-01-19",
			lastDate: "2027-02-11",
		});
		await insertApplication(t, semesterId, { status: "offer_sent", assignedDate: "2027-02-09" });

		const message = await refusalMessageFrom(
			editor.mutation(mutations.setRange, {
				semesterId,
				firstDate: "2027-01-19",
				lastDate: "2027-01-31",
			}),
		);

		expect(message).toBe(
			"2027-02-09 er tildelt FJORDKODE AS. Flytt søknaden før du endrer perioden.",
		);
		expect(await datesOf(t, semesterId)).toHaveLength(8);
	});

	it.each([
		[
			"an invalid date",
			"2027-02-30",
			"2027-05-06",
			"Første dato må være en gyldig dato (ÅÅÅÅ-MM-DD).",
		],
		["a reversed range", "2027-05-06", "2027-01-19", "Første dato må være før siste dato."],
		[
			"a range without Tuesdays or Thursdays",
			"2027-01-22",
			"2027-01-24",
			"Perioden har ingen tirsdager eller torsdager.",
		],
	])("refuses %s", async (_case, firstDate, lastDate, expected) => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "draft" });

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.setRange, { semesterId, firstDate, lastDate }),
		);
		expect(message).toBe(expected);
	});

	it("refuses changes to a closed semester", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "closed" });

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.setRange, {
				semesterId,
				firstDate: "2027-01-19",
				lastDate: "2027-05-06",
			}),
		);
		expect(message).toBe("Semesteret er stengt og kan ikke endres.");
	});
});

describe("setDateClosed", () => {
	async function withOneDate() {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "open" });
		const dateId = await t.run((ctx) =>
			ctx.db.insert("semesterDates", { semesterId, date: "2027-02-09" }),
		);
		return { t, semesterId, dateId, editor: await editorOf(t) };
	}

	it("closes a date with a reason and opens it again", async () => {
		const { t, dateId, editor } = await withOneDate();

		await editor.mutation(mutations.setDateClosed, { dateId, label: "  Internkveld " });
		expect((await t.run((ctx) => ctx.db.get(dateId)))?.closedLabel).toBe("Internkveld");

		await editor.mutation(mutations.setDateClosed, { dateId, label: null });
		expect((await t.run((ctx) => ctx.db.get(dateId)))?.closedLabel).toBeUndefined();
	});

	it("refuses to close a date that a company has been given", async () => {
		const { t, semesterId, dateId, editor } = await withOneDate();
		await insertApplication(t, semesterId, { status: "confirmed", assignedDate: "2027-02-09" });

		const message = await refusalMessageFrom(
			editor.mutation(mutations.setDateClosed, { dateId, label: "Påske" }),
		);
		expect(message).toBe("Datoen er tildelt FJORDKODE AS. Flytt søknaden først.");
	});

	it("allows closing a date held only by a withdrawn application", async () => {
		const { t, semesterId, dateId, editor } = await withOneDate();
		await insertApplication(t, semesterId, { status: "withdrawn", assignedDate: "2027-02-09" });

		await editor.mutation(mutations.setDateClosed, { dateId, label: "Påske" });
		expect((await t.run((ctx) => ctx.db.get(dateId)))?.closedLabel).toBe("Påske");
	});

	it("closes a date without a reason as an empty label", async () => {
		const { t, dateId, editor } = await withOneDate();

		await editor.mutation(mutations.setDateClosed, { dateId, label: "  " });
		expect((await t.run((ctx) => ctx.db.get(dateId)))?.closedLabel).toBe("");

		await editor.mutation(mutations.setDateClosed, { dateId, label: null });
		expect((await t.run((ctx) => ctx.db.get(dateId)))?.closedLabel).toBeUndefined();
	});

	it("changes the reason of a closed date", async () => {
		const { t, dateId, editor } = await withOneDate();

		await editor.mutation(mutations.setDateClosed, { dateId, label: "" });
		await editor.mutation(mutations.setDateClosed, { dateId, label: "Eksamen" });
		expect((await t.run((ctx) => ctx.db.get(dateId)))?.closedLabel).toBe("Eksamen");
	});

	it("refuses to close a date that a company has been given, even without a reason", async () => {
		const { t, semesterId, dateId, editor } = await withOneDate();
		await insertApplication(t, semesterId, { status: "confirmed", assignedDate: "2027-02-09" });

		const message = await refusalMessageFrom(
			editor.mutation(mutations.setDateClosed, { dateId, label: "" }),
		);
		expect(message).toBe("Datoen er tildelt FJORDKODE AS. Flytt søknaden først.");
	});
});

describe("updateSettings", () => {
	it("saves the deadline and start time, and clears a text with an empty string", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "draft", infoText: "Gammel tekst" });

		await (await editorOf(t)).mutation(mutations.updateSettings, {
			semesterId,
			applicationDeadline: "2026-12-04",
			infoText: "",
			defaultEventStartTime: "16:15",
		});

		const semester = await semesterById(t, semesterId);
		expect(semester.applicationDeadline).toBe("2026-12-04");
		expect(semester.infoText).toBeUndefined();
		expect(semester.defaultEventStartTime).toBe("16:15");
	});

	it.each([
		[{ applicationDeadline: "4. desember" }, "Søknadsfristen må være en gyldig dato (ÅÅÅÅ-MM-DD)."],
		[{ termsUrl: "ikke en lenke" }, "Lenken til standardvilkårene er ugyldig."],
		[{ defaultEventStartTime: "9:00" }, "Starttiden må være et gyldig klokkeslett (TT:MM)."],
		[{ defaultEventStartTime: "25:00" }, "Starttiden må være et gyldig klokkeslett (TT:MM)."],
	])("refuses %o", async (settings, expected) => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "draft" });

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.updateSettings, { semesterId, ...settings }),
		);
		expect(message).toBe(expected);
	});
});

describe("setStatus", () => {
	it("refuses to open a semester without dates and a deadline", async () => {
		const { t } = await setup();
		const semesterId = await t.run((ctx) =>
			ctx.db.insert("semesters", { year: 2027, term: "spring", status: "draft" }),
		);

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.setStatus, { semesterId, status: "open" }),
		);
		expect(message).toBe("Sett første dato, siste dato og søknadsfrist før du åpner semesteret.");
	});

	it("refuses to open a semester where every date is closed", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "draft" });
		await t.run((ctx) =>
			ctx.db.insert("semesterDates", { semesterId, date: "2027-01-19", closedLabel: "Kickoff" }),
		);

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.setStatus, { semesterId, status: "open" }),
		);
		expect(message).toBe("Semesteret har ingen åpne datoer.");
	});

	it("refuses to open a second semester", async () => {
		const { t } = await setup();
		await insertSemester(t, { year: 2026, term: "autumn", status: "open" });
		const semesterId = await insertSemester(t, { status: "draft" });
		await t.run((ctx) => ctx.db.insert("semesterDates", { semesterId, date: "2027-01-21" }));

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.setStatus, { semesterId, status: "open" }),
		);
		expect(message).toBe("Høsten 2026 er allerede åpent. Steng det først.");
	});

	it("refuses to open a semester whose last date has passed", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, {
			year: 2020,
			firstDate: "2020-01-14",
			lastDate: "2020-05-14",
			status: "closed",
		});
		await t.run((ctx) => ctx.db.insert("semesterDates", { semesterId, date: "2020-01-14" }));

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.setStatus, { semesterId, status: "open" }),
		);
		expect(message).toBe("Semesteret er over og kan ikke åpnes.");
	});

	it("opens a ready semester", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "draft", lastDate: "2099-12-31" });
		await t.run((ctx) => ctx.db.insert("semesterDates", { semesterId, date: "2027-01-21" }));

		await (await editorOf(t)).mutation(mutations.setStatus, { semesterId, status: "open" });
		expect((await semesterById(t, semesterId)).status).toBe("open");
	});
});

describe("finalizePlan", () => {
	it("records who finalized the plan and keeps the first time", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { defaultEventStartTime: "16:15" });
		const editor = await editorOf(t);

		await editor.mutation(mutations.finalizePlan, { semesterId });
		const first = await semesterById(t, semesterId);
		await editor.mutation(mutations.finalizePlan, { semesterId });

		expect(first.planFinalizedAt).toBeDefined();
		expect(first.planFinalizedBy).toBeDefined();
		expect((await semesterById(t, semesterId)).planFinalizedAt).toBe(first.planFinalizedAt);
	});

	it("refuses while applications wait for an offer or an answer, and says how many", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t);
		for (const status of ["applied", "offer_sent", "confirmed", "declined"] as const) {
			await insertApplication(t, semesterId, { status });
		}

		const message = await refusalMessageFrom(
			(await editorOf(t)).mutation(mutations.finalizePlan, { semesterId }),
		);
		expect(message).toBe("2 søknader venter fortsatt på tilbud eller svar.");
		expect((await semesterById(t, semesterId)).planFinalizedAt).toBeUndefined();
	});

	it("is undone when an application needs an offer again, and by unfinalizePlan", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { defaultEventStartTime: "16:15" });
		await t.run((ctx) => ctx.db.insert("semesterDates", { semesterId, date: "2027-02-16" }));
		const applicationId = await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2027-02-09",
		});
		const editor = await editorOf(t);

		await editor.mutation(mutations.finalizePlan, { semesterId });
		await editor.mutation(api.semesterPlanning.applications.mutations.assignDate, {
			applicationId,
			date: "2027-02-16",
		});
		expect((await semesterById(t, semesterId)).planFinalizedAt).toBeUndefined();

		await t.run((ctx) => ctx.db.patch(applicationId, { status: "confirmed" }));
		await editor.mutation(mutations.finalizePlan, { semesterId });
		expect((await semesterById(t, semesterId)).planFinalizedBy).toBeDefined();
		await editor.mutation(mutations.unfinalizePlan, { semesterId });
		const semester = await semesterById(t, semesterId);
		expect([semester.planFinalizedAt, semester.planFinalizedBy]).toEqual([undefined, undefined]);
	});

	async function withConfirmedApplications() {
		const { t, companyId } = await setup();
		const [responsible, helper] = await Promise.all(
			["emil@ifinavet.no", "ida@ifinavet.no"].map(async (email) => {
				const user = await insertUser(t, email);
				await grantRole(t, user._id, "internal");
				return user;
			}),
		);
		const semesterId = await insertSemester(t, { defaultEventStartTime: "16:15" });
		const applicationId = await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2027-02-09",
			// The org.nr. of the fixture's company profile, «Testbedrift».
			orgNumber: "123456789",
			registry: {
				name: "TESTBEDRIFT AS",
				organizationForm: { code: "AS", description: "Aksjeselskap" },
				fetchedAt: Date.now(),
			},
			responsibleUserId: responsible._id,
			helperUserIds: [helper._id],
		});
		// FJORDKODE AS has no company profile.
		await insertApplication(t, semesterId, { status: "confirmed", assignedDate: "2027-02-11" });
		await insertApplication(t, semesterId, { status: "declined" });
		return {
			t,
			companyId,
			semesterId,
			applicationId,
			responsible,
			helper,
			editor: await editorOf(t),
		};
	}

	async function eventsOf(t: TestBackend) {
		return t.run((ctx) => ctx.db.query("events").collect());
	}

	it("creates a draft event for each confirmed application, and names companies without a profile", async () => {
		const { t, companyId, semesterId, applicationId, responsible, helper, editor } =
			await withConfirmedApplications();

		const result = await editor.mutation(mutations.finalizePlan, { semesterId });

		expect(result).toEqual({ created: 1, missingProfile: ["FJORDKODE AS"] });
		const [event] = await eventsOf(t);
		expect(event).toMatchObject({
			hostingCompany: companyId,
			published: false,
			eventStart: Date.parse("2027-02-09T15:15:00Z"),
		});
		expect((await applicationById(t, applicationId)).eventId).toBe(event?._id);
		const organizers = await t.run((ctx) => ctx.db.query("eventOrganizers").collect());
		// The hand-picked team is kept; the last medhjelper is proposed.
		expect(organizers.map((row) => [row.userId, row.role]).slice(0, 2)).toEqual([
			[responsible._id, "hovedansvarlig"],
			[helper._id, "medhjelper"],
		]);
		expect(organizers).toHaveLength(3);
		const [linked] = await activityFor(t, applicationId);
		expect(linked).toMatchObject({
			type: "event_linked",
			actorUserId: (await semesterById(t, semesterId)).planFinalizedBy,
		});
	});

	it("proposes a Navet team for applications without one, least loaded first", async () => {
		const { t, companyId, semesterId, applicationId, responsible, helper, editor } =
			await withConfirmedApplications();
		await t.run((ctx) =>
			ctx.db.patch(applicationId, { responsibleUserId: undefined, helperUserIds: undefined }),
		);
		// Emil already organizes an event in the semester, so he is picked last.
		const otherEventId = await insertEvent(t, companyId, {
			eventStart: Date.parse("2027-03-02T15:15:00Z"),
		});
		await insertOrganizer(t, otherEventId, responsible._id);

		await editor.mutation(mutations.finalizePlan, { semesterId });

		const { eventId, responsibleUserId, helperUserIds } = await applicationById(t, applicationId);
		expect(helperUserIds).toHaveLength(2);
		expect(responsibleUserId).toBe(helper._id);
		expect(helperUserIds?.at(-1)).toBe(responsible._id);
		const organizers = await t.run((ctx) =>
			ctx.db
				.query("eventOrganizers")
				.withIndex("by_eventId", (q) => q.eq("eventId", eventId as Id<"events">))
				.collect(),
		);
		expect(organizers.map((row) => row.role).sort()).toEqual([
			"hovedansvarlig",
			"medhjelper",
			"medhjelper",
		]);
	});

	it("is safe to repeat, and moves a draft whose date changed", async () => {
		const { t, semesterId, applicationId, editor } = await withConfirmedApplications();
		await editor.mutation(mutations.finalizePlan, { semesterId });

		const again = await editor.mutation(mutations.finalizePlan, { semesterId });
		expect(again.created).toBe(0);

		await editor.mutation(mutations.unfinalizePlan, { semesterId });
		await t.run((ctx) => ctx.db.patch(applicationId, { assignedDate: "2027-02-16" }));
		await editor.mutation(mutations.finalizePlan, { semesterId });

		const events = await eventsOf(t);
		expect(events).toHaveLength(1);
		expect(events[0]?.eventStart).toBe(Date.parse("2027-02-16T15:15:00Z"));
	});

	it("refuses without a start time for events, and makes nothing", async () => {
		const { t, semesterId, editor } = await withConfirmedApplications();
		await t.run((ctx) => ctx.db.patch(semesterId, { defaultEventStartTime: undefined }));

		const message = await refusalMessageFrom(
			editor.mutation(mutations.finalizePlan, { semesterId }),
		);
		expect(message).toBe("Sett starttid for arrangementer i innstillingene først.");
		expect(await eventsOf(t)).toHaveLength(0);
	});

	it("refuses the whole run with the company's name when an event cannot be made", async () => {
		const { t, semesterId, applicationId, responsible, editor } = await withConfirmedApplications();
		await t.run((ctx) =>
			ctx.db.patch(applicationId, { helperUserIds: [responsible._id, responsible._id] }),
		);

		const message = await refusalMessageFrom(
			editor.mutation(mutations.finalizePlan, { semesterId }),
		);
		expect(message).toBe("TESTBEDRIFT AS: Samme person er valgt som medhjelper to ganger.");
		expect((await semesterById(t, semesterId)).planFinalizedAt).toBeUndefined();
	});
});

describe("rolloverSemesters (rollover cron)", () => {
	const rolloverSemesters = internal.semesterPlanning.semesters.mutations.rolloverSemesters;

	it("creates next semester as an empty draft with inherited settings", async () => {
		const { t } = await setup();
		await insertSemester(t, {
			year: 2026,
			term: "autumn",
			status: "open",
			termsUrl: `${MIDGARD_URL}/vilkar`,
		});

		const result = await t.mutation(rolloverSemesters, {
			now: Date.parse("2026-09-23T10:00:00Z"),
		});

		expect(result.closedSemesters).toBe(0);
		expect(result.createdSemesterId).not.toBeNull();
		const created = await semesterById(t, result.createdSemesterId as Id<"semesters">);
		expect(created).toMatchObject({
			year: 2027,
			term: "spring",
			status: "draft",
			termsUrl: `${MIDGARD_URL}/vilkar`,
		});
		expect(created.firstDate).toBeUndefined();
		expect(created.applicationDeadline).toBeUndefined();
		expect(await datesOf(t, created._id)).toHaveLength(0);
	});

	it("is idempotent: running twice creates one semester", async () => {
		const { t } = await setup();
		const now = Date.parse("2026-09-23T10:00:00Z");

		await t.mutation(rolloverSemesters, { now });
		const second = await t.mutation(rolloverSemesters, { now });

		expect(second.createdSemesterId).toBeNull();
		expect(await t.run((ctx) => ctx.db.query("semesters").collect())).toHaveLength(1);
	});

	it("uses the Oslo day: 30 June 23:30 in Oslo is still spring, so autumn comes next", async () => {
		const { t } = await setup();

		const result = await t.mutation(rolloverSemesters, {
			now: Date.parse("2026-06-30T21:30:00Z"),
		});
		const created = await semesterById(t, result.createdSemesterId as Id<"semesters">);

		expect([created.year, created.term]).toEqual([2026, "autumn"]);
	});

	it("uses the Oslo day: 1 July 00:30 in Oslo is autumn, so spring comes next", async () => {
		const { t } = await setup();

		const result = await t.mutation(rolloverSemesters, {
			now: Date.parse("2026-06-30T22:30:00Z"),
		});
		const created = await semesterById(t, result.createdSemesterId as Id<"semesters">);

		expect([created.year, created.term]).toEqual([2027, "spring"]);
	});

	it("closes open semesters whose last date has passed, and nothing else", async () => {
		const { t } = await setup();
		const finishedId = await insertSemester(t, {
			year: 2026,
			term: "spring",
			status: "open",
			lastDate: "2026-05-14",
		});
		const runningId = await insertSemester(t, {
			year: 2026,
			term: "autumn",
			status: "open",
			lastDate: "2026-11-26",
		});
		const draftId = await insertSemester(t, {
			year: 2025,
			term: "autumn",
			status: "draft",
			lastDate: "2025-11-27",
		});

		const result = await t.mutation(rolloverSemesters, {
			now: Date.parse("2026-09-23T10:00:00Z"),
		});

		expect(result.closedSemesters).toBe(1);
		expect((await semesterById(t, finishedId)).status).toBe("closed");
		expect((await semesterById(t, runningId)).status).toBe("open");
		expect((await semesterById(t, draftId)).status).toBe("draft");
	});

	it("never opens a semester", async () => {
		const { t } = await setup();
		await t.mutation(rolloverSemesters, { now: Date.parse("2026-09-23T10:00:00Z") });

		const open = await t.run((ctx) =>
			ctx.db
				.query("semesters")
				.withIndex("by_status", (q) => q.eq("status", "open"))
				.collect(),
		);
		expect(open).toHaveLength(0);
	});
});

describe("queries", () => {
	it("getOpenForApplications returns only open dates and needs no login", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "open", infoText: "Hei" });
		await t.run(async (ctx) => {
			await ctx.db.insert("semesterDates", {
				semesterId,
				date: "2027-01-19",
				closedLabel: "Kickoff",
			});
			await ctx.db.insert("semesterDates", { semesterId, date: "2027-01-21" });
		});
		await insertApplication(t, semesterId, { assignedDate: "2027-01-21", status: "confirmed" });

		const open = await t.query(queries.getOpenForApplications, {});

		expect(open).toEqual({
			_id: semesterId,
			year: 2027,
			term: "spring",
			applicationDeadline: "2026-12-04",
			infoText: "Hei",
			dates: ["2027-01-21"],
		});
	});

	it("getOpenForApplications returns null when no semester is open", async () => {
		const { t } = await setup();
		await insertSemester(t, { status: "draft" });

		expect(await t.query(queries.getOpenForApplications, {})).toBeNull();
	});

	it("getOpenForApplications returns null after a hard deadline, but not a soft one", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, {
			status: "open",
			applicationDeadline: "2020-01-01",
		});
		await t.run((ctx) => ctx.db.insert("semesterDates", { semesterId, date: "2027-01-21" }));

		expect(await t.query(queries.getOpenForApplications, {})).not.toBeNull();
		await t.run((ctx) => ctx.db.patch(semesterId, { hardDeadline: true }));
		expect(await t.query(queries.getOpenForApplications, {})).toBeNull();
	});

	it("list and get require an internal member", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t);

		expect(await refusalMessageFrom(t.query(queries.list, {}))).toContain("innlogget");
		expect(await refusalMessageFrom(t.query(queries.get, { semesterId }))).toContain("innlogget");

		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");
		const { semester, dates, finalizedByName } = await asUser(t, member).query(queries.get, {
			semesterId,
		});
		expect(semester._id).toBe(semesterId);
		expect(dates).toEqual([]);
		expect(finalizedByName).toBeNull();
	});

	it("get names who finished the plan", async () => {
		const { t } = await setup();
		const member = await insertUser(t, "medlem@ifinavet.no", {
			firstName: "Emil",
			lastName: "Moe",
		});
		await grantRole(t, member._id, "internal");
		const semesterId = await insertSemester(t, {
			planFinalizedAt: Date.now(),
			planFinalizedBy: member._id,
		});

		const { finalizedByName } = await asUser(t, member).query(queries.get, { semesterId });
		expect(finalizedByName).toBe("Emil Moe");
	});

	it("list sorts autumn after spring in the same year", async () => {
		const { t } = await setup();
		await insertSemester(t, { year: 2026, term: "spring" });
		await insertSemester(t, { year: 2026, term: "autumn" });
		await insertSemester(t, { year: 2027, term: "spring" });
		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");

		const semesters = await asUser(t, member).query(queries.list, {});
		expect(semesters.map((semester) => `${semester.term} ${semester.year}`)).toEqual([
			"spring 2027",
			"autumn 2026",
			"spring 2026",
		]);
	});
});
