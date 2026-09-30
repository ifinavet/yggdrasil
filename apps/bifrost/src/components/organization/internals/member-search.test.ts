import { describe, expect, it } from "vitest";
import { filterMembers } from "./member-search";

const members = [
	{
		internalId: "1",
		fullName: "Per Hansen",
		email: "per.hansen@ifinavet.no",
		connections: { uioEmail: "perha@uio.no" },
	},
	{ internalId: "2", fullName: "Kari Nordmann", email: "kari@ifinavet.no", connections: null },
];

const ids = (query: string) => filterMembers(members, query).map((member) => member.internalId);

describe("filterMembers", () => {
	it("keeps everyone for a blank query", () => {
		expect(ids("  ")).toEqual(["1", "2"]);
	});

	it("matches on name, ifinavet address and UiO address", () => {
		expect(ids("hansen per")).toEqual(["1"]);
		expect(ids("KARI@ifinavet")).toEqual(["2"]);
		expect(ids("perha@uio")).toEqual(["1"]);
	});

	it("finds nobody for a misspelt name", () => {
		expect(ids("Per Hanssen")).toEqual([]);
	});
});
