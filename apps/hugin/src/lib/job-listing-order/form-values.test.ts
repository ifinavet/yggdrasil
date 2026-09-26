import { logoProblem, MAX_LISTINGS_PER_ORDER } from "@workspace/shared/job-listing-orders";
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

describe("logoProblem", () => {
	it("accepts PNG and SVG within the size limit", () => {
		expect(logoProblem("image/png", 1000)).toBeNull();
		expect(logoProblem("image/svg+xml", 1000)).toBeNull();
	});

	it("rejects other types, a missing type and large files", () => {
		expect(logoProblem(undefined, 1000)).toBe("Logoen må være PNG eller SVG.");
		expect(logoProblem("image/jpeg", 1000)).toBe("Logoen må være PNG eller SVG.");
		expect(logoProblem("image/png", 2_000_000)).toBe("Logoen kan være høyst 1 MB.");
	});
});
