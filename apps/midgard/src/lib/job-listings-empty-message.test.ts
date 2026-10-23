import { describe, expect, it } from "vitest";
import { jobListingsEmptyMessage } from "./job-listings-empty-message";

describe("jobListingsEmptyMessage", () => {
	it("says there are no listings when no filter is active", () => {
		expect(jobListingsEmptyMessage(false)).toBe("Det er ingen stillingsannonser akkurat nå.");
	});

	it("says none match when a filter is active", () => {
		expect(jobListingsEmptyMessage(true)).toBe("Ingen stillingsannonser passer med filteret ditt.");
	});
});
