import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { describe, expect, it } from "vitest";
import { cellKind } from "./cell-kind";

type Application = Doc<"companyApplications">;

const own = "own" as Id<"companyApplications">;
const other = "other" as Id<"companyApplications">;

function application(overrides: Partial<Application> = {}) {
	return {
		_id: own,
		status: "applied" as const,
		assignedDate: undefined,
		availableDates: ["2027-02-09", "2027-02-11"],
		...overrides,
	};
}

const noHolders = new Map<string, { _id: Id<"companyApplications"> }>();

describe("cellKind", () => {
	it("marks the assigned date, the free ticked dates and leaves the rest empty", () => {
		const app = application({ assignedDate: "2027-02-09" });
		const holders = new Map([["2027-02-09", { _id: own }]]);

		expect(cellKind({ application: app, date: "2027-02-09", requested: [], holders })).toBe("got");
		expect(cellKind({ application: app, date: "2027-02-11", requested: [], holders })).toBe("can");
		expect(cellKind({ application: app, date: "2027-02-16", requested: [], holders })).toBeNull();
	});

	it("fades a ticked date another company holds", () => {
		const holders = new Map([["2027-02-11", { _id: other }]]);
		expect(
			cellKind({ application: application(), date: "2027-02-11", requested: [], holders }),
		).toBe("busy");
	});

	it("marks a free requested date, even one the company did not tick", () => {
		const app = application({ status: "new_date_requested", assignedDate: "2027-02-09" });
		expect(
			cellKind({
				application: app,
				date: "2027-02-16",
				requested: ["2027-02-16"],
				holders: noHolders,
			}),
		).toBe("req");
	});

	it("fades a requested date another company holds, so it does not look clickable", () => {
		const app = application({ status: "new_date_requested", assignedDate: "2027-02-09" });
		const holders = new Map([["2027-02-16", { _id: other }]]);
		expect(
			cellKind({ application: app, date: "2027-02-16", requested: ["2027-02-16"], holders }),
		).toBe("busy");
	});

	it("shows where a confirmed application can be moved", () => {
		const app = application({ status: "confirmed", assignedDate: "2027-02-09" });
		expect(
			cellKind({ application: app, date: "2027-02-09", requested: [], holders: noHolders }),
		).toBe("got");
		expect(
			cellKind({ application: app, date: "2027-02-11", requested: [], holders: noHolders }),
		).toBe("can");
	});

	it("fades every ticked date of a withdrawn application, its old date too", () => {
		const app = application({ status: "withdrawn", assignedDate: "2027-02-09" });
		expect(
			cellKind({
				application: app,
				date: "2027-02-09",
				requested: ["2027-02-16"],
				holders: noHolders,
			}),
		).toBe("busy");
		expect(
			cellKind({
				application: app,
				date: "2027-02-16",
				requested: ["2027-02-16"],
				holders: noHolders,
			}),
		).toBeNull();
	});
});
