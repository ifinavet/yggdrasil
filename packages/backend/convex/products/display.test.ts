import {
	formatCount,
	formatOfferCost,
	formatPercent,
	formatVolumeTier,
	isEventProduct,
	NO_FIXED_PRICE_LABEL,
	productParagraphs,
	productPriceLabel,
} from "@workspace/shared/products";
import { describe, expect, it } from "vitest";

describe("formatOfferCost", () => {
	it("formats øre as whole kroner using the offer locale", () => {
		expect(formatOfferCost(4_000_000)).toBe("40.000");
	});
});

describe("formatPercent", () => {
	it("rounds to a whole percent with a spaced sign", () => {
		expect(formatPercent(41.6).replace(/\s/g, " ")).toBe("42 %");
	});
});

describe("formatCount", () => {
	it("groups thousands", () => {
		expect(formatCount(1200).replace(/\s/g, " ")).toBe("1 200");
	});
});

describe("formatVolumeTier", () => {
	it("describes a tier as price for quantity", () => {
		expect(formatVolumeTier({ quantity: 2, totalPriceOre: 550_000 }).replace(/\s/g, " ")).toBe(
			"5 500 kr for 2",
		);
	});
});

describe("productPriceLabel", () => {
	it("prefers a fixed unit price when present", () => {
		expect(productPriceLabel({ unitPriceOre: 3_000_000 }).replace(/\s/g, " ")).toBe("30 000 kr");
	});

	it("falls back to the first volume tier when there is no fixed price", () => {
		const label = productPriceLabel({
			volumeTiers: [
				{ quantity: 1, totalPriceOre: 300_000 },
				{ quantity: 2, totalPriceOre: 550_000 },
			],
		});
		expect(label.replace(/\s/g, " ")).toBe("3 000 kr for 1");
	});

	it("falls back to the no fixed price label without a price or tiers", () => {
		expect(productPriceLabel({})).toBe(NO_FIXED_PRICE_LABEL);
	});
});

describe("productParagraphs", () => {
	it("splits on blank lines and trims each paragraph", () => {
		const text = "  Første avsnitt.  \n\n\nAndre avsnitt.\n \nTredje.";
		expect(productParagraphs(text)).toEqual(["Første avsnitt.", "Andre avsnitt.", "Tredje."]);
	});

	it("drops empty paragraphs", () => {
		expect(productParagraphs("\n\n\n")).toEqual([]);
	});
});

describe("isEventProduct", () => {
	it.each([
		["event", true],
		["external_event", true],
		["job_listing", false],
		["other", false],
	] as const)("category %s is event product: %s", (category, expected) => {
		expect(isEventProduct({ category })).toBe(expected);
	});
});
