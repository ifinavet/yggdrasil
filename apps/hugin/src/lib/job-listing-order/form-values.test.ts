import { MAX_LISTINGS_PER_ORDER } from "@workspace/shared/job-listing-orders";
import { describe, expect, it } from "vitest";
import { emptyListing, resizeListings } from "./form-values";

describe("resizeListings", () => {
	const filled = { ...emptyListing(), title: "Utvikler" };

	it("keeps existing listings and appends empty ones", () => {
		expect(resizeListings([filled], 3)).toEqual([filled, emptyListing(), emptyListing()]);
	});

	it("drops listings from the end when shrinking", () => {
		expect(resizeListings([filled, emptyListing()], 1)).toEqual([filled]);
	});

	it("stays between one listing and the order maximum", () => {
		expect(resizeListings([filled], 0)).toEqual([filled]);
		expect(resizeListings([], MAX_LISTINGS_PER_ORDER + 5)).toHaveLength(MAX_LISTINGS_PER_ORDER);
	});
});
