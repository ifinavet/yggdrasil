import {
	GOOGLE_JOB_LISTING_FORM_URL,
	JOB_LISTING_ORDER_PATH,
	jobListingOrderUrl,
} from "@workspace/shared/job-listing-orders";
import { describe, expect, it } from "vitest";

const HUGIN = "https://hugin.example.test";

describe("jobListingOrderUrl", () => {
	it("points to the Hugin order form when orders are enabled", () => {
		expect(jobListingOrderUrl(HUGIN, true)).toBe(`${HUGIN}${JOB_LISTING_ORDER_PATH}`);
	});

	it("falls back to the Google form when orders are disabled", () => {
		expect(jobListingOrderUrl(HUGIN, false)).toBe(GOOGLE_JOB_LISTING_FORM_URL);
	});
});
