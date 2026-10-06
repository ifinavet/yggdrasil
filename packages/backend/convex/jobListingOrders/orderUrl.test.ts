import { JOB_LISTING_ORDER_PATH, jobListingOrderUrl } from "@workspace/shared/job-listing-orders";
import { describe, expect, it } from "vitest";

const HUGIN = "https://hugin.example.test";

describe("jobListingOrderUrl", () => {
	it("points to the Hugin order form", () => {
		expect(jobListingOrderUrl(HUGIN)).toBe(`${HUGIN}${JOB_LISTING_ORDER_PATH}`);
	});
});
