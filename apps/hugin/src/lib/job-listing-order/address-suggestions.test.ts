import { describe, expect, it } from "vitest";
import { moveActiveSuggestion } from "./address-suggestions";

describe("moveActiveSuggestion", () => {
	it("starts at the first or last suggestion when none is active", () => {
		expect(moveActiveSuggestion(-1, 1, 3)).toBe(0);
		expect(moveActiveSuggestion(-1, -1, 3)).toBe(2);
	});

	it("wraps around both ends", () => {
		expect(moveActiveSuggestion(2, 1, 3)).toBe(0);
		expect(moveActiveSuggestion(0, -1, 3)).toBe(2);
		expect(moveActiveSuggestion(1, 1, 3)).toBe(2);
	});

	it("has nothing to activate without suggestions", () => {
		expect(moveActiveSuggestion(-1, 1, 0)).toBe(-1);
		expect(moveActiveSuggestion(4, -1, 0)).toBe(-1);
	});
});
