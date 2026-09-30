import { describe, expect, it } from "vitest";
import { isRowClick } from "./row-click";

function target(interactiveAncestor: boolean) {
	return { closest: () => (interactiveAncestor ? ({} as Element) : null) };
}

function row(containsTarget: boolean) {
	return { contains: () => containsTarget };
}

describe("isRowClick", () => {
	it("accepts clicks on plain cell content", () => {
		expect(isRowClick(row(true), target(false))).toBe(true);
	});

	it("leaves clicks on buttons, inputs and links to the control itself", () => {
		expect(isRowClick(row(true), target(true))).toBe(false);
	});

	it("ignores clicks that bubble up from dialogs portaled out of the row", () => {
		expect(isRowClick(row(false), target(false))).toBe(false);
	});
});
