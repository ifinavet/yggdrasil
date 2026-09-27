import { invoiceDueAt } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";

describe("invoiceDueAt", () => {
	it("is six in the morning Oslo time one month after the service", () => {
		expect(invoiceDueAt(Date.parse("2027-02-09T15:15:00Z"))).toBe(
			Date.parse("2027-03-09T05:00:00Z"),
		);
	});

	it("lands on the last day of a shorter month", () => {
		expect(invoiceDueAt(Date.parse("2027-01-31T12:00:00Z"))).toBe(
			Date.parse("2027-02-28T05:00:00Z"),
		);
	});

	it("follows the clock change to summer time", () => {
		expect(invoiceDueAt(Date.parse("2027-03-01T12:00:00Z"))).toBe(
			Date.parse("2027-04-01T04:00:00Z"),
		);
	});

	it("uses the Oslo date for a service late in the evening", () => {
		expect(invoiceDueAt(Date.parse("2027-01-31T23:30:00Z"))).toBe(
			Date.parse("2027-03-01T05:00:00Z"),
		);
	});
});
