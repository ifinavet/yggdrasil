import { describe, expect, it } from "vitest";
import { errorText } from "./question-block";

describe("errorText", () => {
	it("joins string and object messages and skips empty ones", () => {
		expect(errorText([undefined, "", "Skriv navnet.", { message: "Annet" }])).toBe(
			"Skriv navnet., Annet",
		);
	});

	it("returns undefined when there is no message", () => {
		expect(errorText([])).toBeUndefined();
		expect(errorText([undefined, ""])).toBeUndefined();
	});
});
