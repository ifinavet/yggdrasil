import { proposeTeams } from "@workspace/shared/semester/team";
import { describe, expect, it } from "vitest";

const noLoad = new Map<string, number>();

describe("proposeTeams", () => {
	it("fills a kontaktperson and two medhjelpere from the least loaded, ties by id", () => {
		const load = new Map([
			["a", 2],
			["b", 0],
			["c", 1],
			["d", 0],
		]);

		expect(proposeTeams([{ id: 1 }], ["a", "b", "c", "d"], load)).toEqual([
			{ id: 1, responsibleUserId: "b", helperUserIds: ["d", "c"] },
		]);
	});

	it("keeps hand-picked members and counts them and earlier picks as load", () => {
		const teams = proposeTeams(
			[
				{ id: 1, helperUserIds: ["a"] },
				{ id: 2, responsibleUserId: "b" },
			],
			["a", "b", "c", "d", "e"],
			noLoad,
		);

		expect(teams).toEqual([
			{ id: 1, responsibleUserId: "c", helperUserIds: ["a", "d"] },
			{ id: 2, responsibleUserId: "b", helperUserIds: ["e", "a"] },
		]);
	});

	it("never picks someone twice for one application, and fills what it can", () => {
		expect(proposeTeams([{ id: 1, responsibleUserId: "a" }], ["a", "b", "b"], noLoad)).toEqual([
			{ id: 1, responsibleUserId: "a", helperUserIds: ["b"] },
		]);
		expect(proposeTeams([{ id: 1 }], [], noLoad)).toEqual([{ id: 1, helperUserIds: [] }]);
	});

	it("gives the same result every time, whatever the candidate order", () => {
		const applications = [{ id: 1 }, { id: 2 }];

		expect(proposeTeams(applications, ["c", "a", "b"], noLoad)).toEqual(
			proposeTeams(applications, ["b", "c", "a"], noLoad),
		);
	});
});
