import { describe, expect, it } from "vitest";
import {
	emptyProductFormValues,
	existingSalesNote,
	perListingOre,
	priceWithVatOre,
	toProductFormValues,
	toProductInput,
	validateProductForm,
} from "./product-form-values";

const jobListing = {
	...emptyProductFormValues,
	name: "Stillingsannonse",
	category: "job_listing" as const,
	volumeTiers: [
		{ key: "a", quantity: "1", totalPrice: "3 000" },
		{ key: "b", quantity: "2", totalPrice: "5500,50" },
	],
	startupPrice: "500",
};

describe("product form values", () => {
	it("converts kroner with spaces and decimal commas to øre", () => {
		expect(toProductInput(jobListing)).toMatchObject({
			volumeTiers: [
				{ quantity: 1, totalPriceOre: 300_000 },
				{ quantity: 2, totalPriceOre: 550_050 },
			],
			startupPriceOre: 50_000,
			unitPriceOre: undefined,
			vatRate: 25,
		});
	});

	it("drops tiers and startup price for products that are not job listings", () => {
		const input = toProductInput({ ...jobListing, category: "event", unitPrice: "40000" });
		expect(input.volumeTiers).toBeUndefined();
		expect(input.startupPriceOre).toBeUndefined();
		expect(input.unitPriceOre).toBe(4_000_000);
	});

	it("round-trips a stored product", () => {
		const stored = {
			name: "Stor",
			shortDescription: "",
			longDescription: "",
			category: "job_listing" as const,
			vatRate: 25,
			volumeTiers: [{ quantity: 1, totalPriceOre: 300_000 }],
			startupPriceOre: 50_000,
			maxStudents: 40,
		};
		expect(toProductInput(toProductFormValues(stored))).toEqual({
			...stored,
			unitPriceOre: undefined,
		});
		expect(toProductFormValues({ ...stored, volumeTiers: undefined }).volumeTiers).toEqual([]);
	});

	it("maps shared validation messages onto the form fields", () => {
		expect(validateProductForm(jobListing)).toBeUndefined();
		expect(
			validateProductForm({
				...jobListing,
				name: "",
				unitPrice: "abc",
				vatRate: "",
				volumeTiers: [{ key: "a", quantity: "x", totalPrice: "" }],
			})?.fields,
		).toEqual({
			name: "Skriv et produktnavn.",
			unitPrice: "Prisen må være et beløp mellom 0 og 1 000 000 kr.",
			vatRate: "Mva må være en prosent mellom 0 og 100.",
			volumeTiers: "Antall må være et helt tall fra 1.",
		});
	});

	it("adds mva to the price", () => {
		expect(priceWithVatOre({ unitPrice: "30 000", vatRate: "25" })).toBe(3_750_000);
		expect(priceWithVatOre({ unitPrice: "", vatRate: "25" })).toBeUndefined();
		expect(priceWithVatOre({ unitPrice: "30 000", vatRate: "x" })).toBeUndefined();
	});

	it("splits a tier price per listing", () => {
		expect(perListingOre({ quantity: "2", totalPrice: "5 500" })).toBe(275_000);
		expect(perListingOre({ quantity: "0", totalPrice: "5 500" })).toBeUndefined();
		expect(perListingOre({ quantity: "", totalPrice: "5 500" })).toBeUndefined();
		expect(perListingOre({ quantity: "2", totalPrice: "abc" })).toBeUndefined();
	});

	it("explains that earlier sales keep their price", () => {
		expect(existingSalesNote(0, "høst 2026", "30 000 kr")).toBeNull();
		expect(existingSalesNote(1, "høst 2026", "30 000 kr")).toBe(
			"En ny pris gjelder bare nye salg: arrangementet som allerede er solgt i høst 2026 beholder 30 000 kr.",
		);
		expect(existingSalesNote(5, "høst 2026", "30 000 kr")).toBe(
			"En ny pris gjelder bare nye salg: de 5 arrangementene som allerede er solgt i høst 2026 beholder 30 000 kr.",
		);
	});
});
