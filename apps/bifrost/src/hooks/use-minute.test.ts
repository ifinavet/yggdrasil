import { describe, expect, it } from "vitest";
import { startOfOsloDay } from "./use-minute";

describe("startOfOsloDay", () => {
	it("returns Oslo midnight in winter time", () => {
		expect(startOfOsloDay(Date.parse("2026-01-15T10:30:45Z"))).toBe(
			Date.parse("2026-01-14T23:00:00Z"),
		);
	});

	it("returns Oslo midnight in summer time", () => {
		expect(startOfOsloDay(Date.parse("2026-07-15T10:30:45Z"))).toBe(
			Date.parse("2026-07-14T22:00:00Z"),
		);
	});

	it("keeps one value for every minute of an Oslo day", () => {
		expect(startOfOsloDay(Date.parse("2026-07-15T21:59:00Z"))).toBe(
			Date.parse("2026-07-14T22:00:00Z"),
		);
	});

	it("changes at the next Oslo midnight", () => {
		expect(startOfOsloDay(Date.parse("2026-07-15T22:00:00Z"))).toBe(
			Date.parse("2026-07-15T22:00:00Z"),
		);
	});
});
