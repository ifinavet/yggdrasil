import { describe, expect, it } from "vitest";
import { visibleTabs } from "./tabs";

describe("visibleTabs", () => {
	it("shows every tab to someone who plans the semester", () => {
		expect(visibleTabs(true).map((tab) => tab.value)).toEqual([
			"plan",
			"fordeling",
			"soknader",
			"innstillinger",
		]);
	});

	it("shows only Plan to other internal members", () => {
		expect(visibleTabs(false).map((tab) => tab.value)).toEqual(["plan"]);
	});
});
