import { invoiceDueAt } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";

describe("invoiceDueAt", () => {
	it.each([
		[
			"is six in the morning Oslo time one month after the service",
			"2027-02-09T15:15:00Z",
			"2027-03-09T05:00:00Z",
		],
		["lands on the last day of a shorter month", "2027-01-31T12:00:00Z", "2027-02-28T05:00:00Z"],
		["follows the clock change to summer time", "2027-03-01T12:00:00Z", "2027-04-01T04:00:00Z"],
		[
			"uses the Oslo date for a service late in the evening",
			"2027-01-31T23:30:00Z",
			"2027-03-01T05:00:00Z",
		],
	])("%s", (_, serviceAt, dueAt) => {
		expect(invoiceDueAt(Date.parse(serviceAt))).toBe(Date.parse(dueAt));
	});
});
