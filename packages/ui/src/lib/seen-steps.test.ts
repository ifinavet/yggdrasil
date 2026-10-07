import { describe, expect, it } from "vitest";
import { nextUnseenStep } from "./seen-steps";

describe("nextUnseenStep", () => {
	const order = ["start", "calendars", "generate", "approve"] as const;

	it("picks the first available step that has not been seen", () => {
		expect(nextUnseenStep(order, new Set(["calendars", "generate"]), [])).toBe("calendars");
		expect(nextUnseenStep(order, new Set(["calendars", "generate"]), ["calendars"])).toBe(
			"generate",
		);
	});

	it("skips steps that do not apply to the current state", () => {
		expect(nextUnseenStep(order, new Set(["approve"]), [])).toBe("approve");
	});

	it("returns null once every available step is seen", () => {
		expect(nextUnseenStep(order, new Set(["start"]), ["start"])).toBeNull();
	});
});
