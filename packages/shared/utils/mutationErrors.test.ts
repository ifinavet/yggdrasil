import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { describeMutationError } from "./mutationErrors";

const FALLBACK = "Noe gikk galt. Prøv igjen.";

describe("describeMutationError", () => {
	it("shows the message the server refused with", () => {
		const error = new ConvexError("Krever rollen: super-admin.");

		expect(describeMutationError(error, FALLBACK)).toBe("Krever rollen: super-admin.");
	});

	it("shows the message for a closed registration", () => {
		const error = new ConvexError('Påmelding til arrangementet "Testarrangement" er stengt.');

		expect(describeMutationError(error, FALLBACK)).toBe(
			'Påmelding til arrangementet "Testarrangement" er stengt.',
		);
	});

	it("falls back for an error the server did not describe", () => {
		expect(describeMutationError(new Error("Uncaught TypeError"), FALLBACK)).toBe(FALLBACK);
	});

	it("falls back when the ConvexError carries structured data", () => {
		expect(describeMutationError(new ConvexError({ code: "forbidden" }), FALLBACK)).toBe(FALLBACK);
	});

	it("falls back for a thrown value that is not an error", () => {
		expect(describeMutationError("noe gikk galt", FALLBACK)).toBe(FALLBACK);
	});
});
