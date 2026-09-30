import { describe, expect, it } from "vitest";
import { includesAll, withToggled } from "./bulk-selection";

describe("withToggled", () => {
	it("adds a checked id without touching the original", () => {
		const selected = new Set(["a"]);
		expect([...withToggled(selected, "b", true)]).toEqual(["a", "b"]);
		expect([...selected]).toEqual(["a"]);
	});

	it("removes an unchecked id", () => {
		expect([...withToggled(new Set(["a", "b"]), "a", false)]).toEqual(["b"]);
	});
});

describe("includesAll", () => {
	it("is true only when every visible id is selected", () => {
		expect(includesAll(new Set(["a", "b", "c"]), ["a", "b"])).toBe(true);
		expect(includesAll(new Set(["a"]), ["a", "b"])).toBe(false);
	});

	it("is false when nothing is visible", () => {
		expect(includesAll(new Set(["a"]), [])).toBe(false);
	});
});
