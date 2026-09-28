import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { describe, expect, it } from "vitest";
import {
	buildPlanDays,
	filterPlanDays,
	NO_FILTER,
	type PlanEventRow,
	type PlanRow,
} from "./plan-days";

function semesterDate(date: string, closedLabel?: string) {
	return { date, closedLabel } as Doc<"semesterDates">;
}

function row(id: string, overrides: Partial<PlanRow> = {}): PlanRow {
	return {
		_id: id as Id<"companyApplications">,
		status: "applied",
		companyName: `Bedrift ${id}`,
		eventType: "standard_presentation",
		maxStudents: 40,
		helpers: [],
		...overrides,
	};
}

const kari = "kari" as Id<"users">;

function planEvent(id: string, date: string, overrides: Partial<PlanEventRow> = {}): PlanEventRow {
	return {
		_id: id as Id<"semesterPlanEvents">,
		eventId: `event-${id}` as Id<"events">,
		date,
		eventStart: Date.parse(`${date}T14:15:00Z`),
		title: `Bedpres ${id}`,
		companyName: `Bedrift ${id}`,
		published: true,
		participationLimit: 40,
		helpers: [],
		...overrides,
	};
}

describe("buildPlanDays", () => {
	it("gives every semester date a day: closed, free or held, in calendar order", () => {
		const days = buildPlanDays(
			[semesterDate("2027-02-09"), semesterDate("2027-02-11", ""), semesterDate("2027-02-16")],
			[row("a", { assignedDate: "2027-02-16" })],
			undefined,
		);

		expect(days.map((day) => [day.date, day.kind])).toEqual([
			["2027-02-09", "free"],
			["2027-02-11", "closed"],
			["2027-02-16", "assigned"],
		]);
		expect(days[1]).toMatchObject({ label: "Stengt" });
	});

	it("leaves the date of a withdrawn or rejected application free", () => {
		const days = buildPlanDays(
			[semesterDate("2027-02-09")],
			[row("a", { assignedDate: "2027-02-09", status: "withdrawn" })],
			undefined,
		);
		expect(days[0]?.kind).toBe("free");
	});

	it("adds the contact details only for editors", () => {
		const application = {
			_id: "a",
			orgNumber: "924773189",
			contact: { name: "Ingrid", email: "ingrid@fjordkode.no", phone: "+4741234567" },
		} as Doc<"companyApplications">;
		const dates = [semesterDate("2027-02-09")];
		const rows = [row("a", { assignedDate: "2027-02-09" })];

		expect(buildPlanDays(dates, rows, [application])[0]).toMatchObject({
			details: { orgNumber: "924773189" },
		});
		expect(buildPlanDays(dates, rows, undefined)[0]).toMatchObject({ details: undefined });
	});
});

describe("buildPlanDays with events in the plan", () => {
	it("shows an event instead of Ledig on a free semester date", () => {
		const days = buildPlanDays(
			[semesterDate("2027-02-09"), semesterDate("2027-02-11")],
			[],
			undefined,
			[planEvent("x", "2027-02-09")],
		);

		expect(days.map((day) => [day.date, day.kind])).toEqual([
			["2027-02-09", "event"],
			["2027-02-11", "free"],
		]);
		expect(days[0]).toMatchObject({ extraDay: false });
	});

	it("adds an extra day for an event on a weekday without a semester date, in calendar order", () => {
		const days = buildPlanDays(
			[semesterDate("2027-02-09"), semesterDate("2027-02-11")],
			[],
			undefined,
			[planEvent("w", "2027-02-10")],
		);

		expect(days.map((day) => [day.date, day.kind])).toEqual([
			["2027-02-09", "free"],
			["2027-02-10", "event"],
			["2027-02-11", "free"],
		]);
		expect(days[1]).toMatchObject({ extraDay: true });
	});

	it("keeps both the application and an event on the same date, and an event next to a closed date", () => {
		const days = buildPlanDays(
			[semesterDate("2027-02-09"), semesterDate("2027-02-11", "Kickoff")],
			[row("a", { assignedDate: "2027-02-09" })],
			undefined,
			[planEvent("x", "2027-02-09"), planEvent("y", "2027-02-11")],
		);

		expect(days.map((day) => [day.date, day.kind])).toEqual([
			["2027-02-09", "assigned"],
			["2027-02-09", "event"],
			["2027-02-11", "closed"],
			["2027-02-11", "event"],
		]);
	});

	it("leaves out an event that belongs to an assigned application", () => {
		const eventId = "event-a" as Id<"events">;
		const days = buildPlanDays(
			[semesterDate("2027-02-09")],
			[row("a", { assignedDate: "2027-02-09", eventId })],
			undefined,
			[planEvent("x", "2027-02-09", { eventId })],
		);

		expect(days.map((day) => day.kind)).toEqual(["assigned"]);
	});
});

describe("filterPlanDays with events in the plan", () => {
	const days = buildPlanDays(
		[semesterDate("2027-02-09"), semesterDate("2027-02-11")],
		[row("a", { assignedDate: "2027-02-09", status: "confirmed", responsibleUserId: kari })],
		undefined,
		[planEvent("x", "2027-02-11", { responsibleUserId: kari }), planEvent("y", "2027-02-10")],
	);

	it("drops events with a status filter and keeps them with a matching kontaktperson", () => {
		const kinds = (filter: Parameters<typeof filterPlanDays>[1]) =>
			filterPlanDays(days, filter).map((day) => `${day.date} ${day.kind}`);

		expect(kinds({ status: "confirmed", responsible: "all" })).toEqual(["2027-02-09 assigned"]);
		expect(kinds({ status: "all", responsible: kari })).toEqual([
			"2027-02-09 assigned",
			"2027-02-11 event",
		]);
		expect(kinds({ status: "all", responsible: "none" })).toEqual(["2027-02-10 event"]);
	});
});

describe("filterPlanDays", () => {
	const days = buildPlanDays(
		[semesterDate("2027-02-09"), semesterDate("2027-02-11"), semesterDate("2027-02-16")],
		[
			row("a", { assignedDate: "2027-02-09", status: "confirmed", responsibleUserId: kari }),
			row("b", { assignedDate: "2027-02-11" }),
		],
		undefined,
	);

	it("keeps the whole plan, free dates too, without a filter", () => {
		expect(filterPlanDays(days, NO_FILTER)).toHaveLength(3);
	});

	it("keeps only the matching assigned dates with a filter", () => {
		const dates = (filter: Parameters<typeof filterPlanDays>[1]) =>
			filterPlanDays(days, filter).map((day) => day.date);

		expect(dates({ status: "confirmed", responsible: "all" })).toEqual(["2027-02-09"]);
		expect(dates({ status: "all", responsible: kari })).toEqual(["2027-02-09"]);
		expect(dates({ status: "all", responsible: "none" })).toEqual(["2027-02-11"]);
		expect(dates({ status: "offer_sent", responsible: "all" })).toEqual([]);
	});
});
