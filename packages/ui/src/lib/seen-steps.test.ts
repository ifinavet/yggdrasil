import { describe, expect, it } from "vitest";
import { nextUnseenStep, parseSeenSteps } from "./seen-steps";

describe("parseSeenSteps", () => {
	it("reads a stored list of step ids", () => {
		expect(parseSeenSteps('["start","calendars"]')).toEqual(["start", "calendars"]);
	});

	it("treats missing, broken or foreign values as nothing seen", () => {
		expect(parseSeenSteps(null)).toEqual([]);
		expect(parseSeenSteps("{not json")).toEqual([]);
		expect(parseSeenSteps('{"start":true}')).toEqual([]);
		expect(parseSeenSteps('["start",3,null]')).toEqual(["start"]);
	});
});

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
