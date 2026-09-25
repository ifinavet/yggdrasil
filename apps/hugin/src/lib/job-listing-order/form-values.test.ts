import { MAX_LISTINGS_PER_ORDER } from "@workspace/shared/job-listing-orders";
import { describe, expect, it } from "vitest";
import { companyCopy } from "./copy";
import { emptyListing, resizeListings } from "./form-values";
import { logoProblem } from "./logo";

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
		expect(logoProblem({ type: "image/png", size: 1000 })).toBeNull();
		expect(logoProblem({ type: "image/svg+xml", size: 1000 })).toBeNull();
	});

	it("rejects other types and large files", () => {
		expect(logoProblem({ type: "image/jpeg", size: 1000 })).toBe(companyCopy.logoWrongType);
		expect(logoProblem({ type: "image/png", size: 2_000_000 })).toBe(companyCopy.logoTooLarge);
	});
});
