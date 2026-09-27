import type { SalesOverview, SalesTotals } from "@workspace/shared/products";
import { describe, expect, it } from "vitest";
import { comparisonSuffix, guessedWarning, salesKpis } from "./sales-kpis";

const normalize = (text: string) => text.replace(/\s/g, " ");

const totals: SalesTotals = {
	revenueOre: 48_000_000,
	eventsSold: 20,
	guessedEvents: 2,
	averagePresentationPriceOre: 2_026_000,
	payingCompanies: 18,
	jobListings: 14,
	jobListingRevenueOre: 6_300_000,
	averageJobListingPriceOre: 452_000,
};

function overview(patch: Partial<SalesOverview> = {}): SalesOverview {
	return {
		totals,
		previous: {
			...totals,
			revenueOre: 40_000_000,
			eventsSold: 25,
			averagePresentationPriceOre: 2_000_000,
		},
		comparedWith: { semester: "høst", year: 2025 },
		returningCompanies: 12,
		...patch,
	};
}

describe("comparisonSuffix", () => {
	it("describes the whole window when all semesters are selected", () => {
		expect(comparisonSuffix(overview(), true)).toBe("siste fem år");
	});

	it("says there is nothing to compare with when last year has no sales", () => {
		expect(comparisonSuffix(overview({ comparedWith: null }), false)).toBe("ingen sammenligning");
	});

	it("compares to the whole semester last year", () => {
		expect(comparisonSuffix(overview(), false)).toBe("mot høst 2025");
	});
});

describe("salesKpis", () => {
	it("builds the five KPIs for a single semester", () => {
		const kpis = salesKpis(overview(), false);

		expect(kpis.map((kpi) => kpi.label)).toEqual([
			"Inntekt eks. mva.",
			"Arrangementer solgt",
			"Snittpris bedriftspresentasjon",
			"Betalende bedrifter",
			"Stillingsannonser",
		]);
		expect(kpis.map((kpi) => normalize(kpi.value))).toEqual([
			"480 000 kr",
			"20",
			"20 500 kr",
			"18",
			"14",
		]);
		expect(kpis.map((kpi) => kpi.change)).toEqual([20, -20, 1.3, null, null]);
		expect(normalize(kpis[3]?.suffix ?? "")).toBe("12 tilbakevendende, 67 %");
		expect(normalize(kpis[4]?.suffix ?? "")).toBe("63 000 kr, snitt 4 500 kr");
	});

	it("counts repeat buyers across the window when all semesters are selected", () => {
		const kpis = salesKpis(overview({ previous: null, comparedWith: null }), true);

		expect(kpis[0]?.change).toBeNull();
		expect(kpis[0]?.suffix).toBe("siste fem år");
		expect(kpis[3]?.suffix).toBe("12 har kjøpt mer enn én gang");
	});

	it("shows zero prices and no share when nothing was sold", () => {
		const empty: SalesTotals = {
			...totals,
			averagePresentationPriceOre: null,
			averageJobListingPriceOre: null,
			payingCompanies: 0,
		};
		const kpis = salesKpis(
			overview({ totals: empty, previous: null, returningCompanies: 0 }),
			false,
		);

		expect(normalize(kpis[2]?.value ?? "")).toBe("0 kr");
		expect(normalize(kpis[3]?.suffix ?? "")).toBe("0 tilbakevendende, 0 %");
		expect(normalize(kpis[4]?.suffix ?? "")).toBe("63 000 kr, snitt 0 kr");
	});
});

describe("guessedWarning", () => {
	it("is hidden when no event has a guessed product", () => {
		expect(guessedWarning(0, 20, "Høst 2026")).toBeNull();
	});

	it("names the share of guessed events in the scope", () => {
		expect(guessedWarning(2, 20, "Høst 2026")).toBe(
			"2 av 20 arrangementer i høst 2026 har et gjettet produkt, så tallene kan være feil.",
		);
	});
});
