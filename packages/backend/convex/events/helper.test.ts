import { describe, expect, it } from "vitest";
import { eventSlug } from "./helper";

describe("eventSlug", () => {
	it.each([
		["2027-02-09T15:15:00Z", "v27"],
		["2027-06-30T12:00:00Z", "v27"],
		["2027-07-01T12:00:00Z", "h27"],
		// 23:30 UTC on 31 December is already the next year in Oslo.
		["2026-12-31T23:30:00Z", "v27"],
	])("prefixes an event starting %s with %s", (start, prefix) => {
		expect(eventSlug("Bedpres", Date.parse(start))).toMatch(new RegExp(`^${prefix}-bedpres-`));
	});
});
