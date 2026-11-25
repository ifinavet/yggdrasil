import { describe, expect, it } from "vitest";
import { hasJobListingsCarouselControls } from "./job-listings-carousel-controls";

describe("hasJobListingsCarouselControls", () => {
	it.each([0, 1, 2, 3])("hides controls for %i listings", (listingCount) => {
		expect(hasJobListingsCarouselControls(listingCount)).toBe(false);
	});

	it.each([4, 10])("shows controls for %i listings", (listingCount) => {
		expect(hasJobListingsCarouselControls(listingCount)).toBe(true);
	});
});
