import {
	formatNokFromOre,
	kronerToOre,
	oreToKroner,
	productInputSchema,
	tierTotalOre,
} from "@workspace/shared/products";
import { describe, expect, it } from "vitest";

const tiers = [
	{ quantity: 3, totalPriceOre: 750_000 },
	{ quantity: 1, totalPriceOre: 300_000 },
	{ quantity: 2, totalPriceOre: 550_000 },
];

describe("money", () => {
	it("converts between kroner and øre without float drift", () => {
		expect(kronerToOre(19.99)).toBe(1999);
		expect(oreToKroner(4_000_000)).toBe(40_000);
	});

	it("formats øre as whole Norwegian kroner", () => {
		expect(formatNokFromOre(4_000_000).replace(/\s/g, " ")).toBe("40 000 kr");
	});

	it.each([
		[0, 0],
		[1, 300_000],
		[2, 550_000],
		[3, 750_000],
		[4, 1_050_000],
		[7, 1_800_000],
	])("prices %i listings as %i øre", (quantity, total) => {
		expect(tierTotalOre(tiers, quantity)).toBe(total);
	});

	it("prices nothing without tiers", () => {
		expect(tierTotalOre([], 2)).toBe(0);
	});
});

describe("product input", () => {
	const valid = {
		name: "  Stor  ",
		shortDescription: "",
		longDescription: "",
		category: "event",
		vatRate: 25,
	};

	it("trims text and sorts tiers by quantity", () => {
		const parsed = productInputSchema.parse({ ...valid, volumeTiers: tiers });
		expect(parsed.name).toBe("Stor");
		expect(parsed.volumeTiers?.map((tier) => tier.quantity)).toEqual([1, 2, 3]);
	});

	it.each([
		[{ name: " " }, "Skriv et produktnavn."],
		[{ unitPriceOre: 10.5 }, "Prisen må være et beløp mellom 0 og 1 000 000 kr."],
		[{ unitPriceOre: -1 }, "Prisen må være et beløp mellom 0 og 1 000 000 kr."],
		[{ vatRate: 101 }, "Mva må være en prosent mellom 0 og 100."],
		[{ maxStudents: 0 }, "Maks antall studenter må være et helt tall fra 1."],
		[
			{ volumeTiers: [tiers[0], tiers[0]] },
			"Mengderabatter må ha 1 til 10 trinn med ulike antall.",
		],
		[{ volumeTiers: [] }, "Mengderabatter må ha 1 til 10 trinn med ulike antall."],
	])("rejects %o", (override, message) => {
		const result = productInputSchema.safeParse({ ...valid, ...override });
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
	});
});
