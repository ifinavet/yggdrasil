import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { describe, expect, it } from "vitest";
import { buildPlanDays, filterPlanDays, NO_FILTER, type PlanRow } from "./plan-days";

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
