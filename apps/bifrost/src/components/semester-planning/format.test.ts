import { describe, expect, it } from "vitest";
import { capitalize, longDay, shortDay } from "./format";

describe("semester days", () => {
	it("writes a day short in a sentence, capitalized on its own, and in full without the year", () => {
		expect(shortDay("2027-02-09")).toBe("tir 9. feb");
		expect(capitalize(shortDay("2027-02-09"))).toBe("Tir 9. feb");
		expect(longDay("2027-02-09")).toBe("tirsdag 9. februar");
	});
});
