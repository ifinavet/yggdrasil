import {
	formatCount,
	formatNok,
	formatPercent,
	ORE_PER_KRONE,
	percentChange,
	type SalesOverview,
	semesterLabel,
} from "@workspace/shared/products";

const PRESENTATION_PRICE_STEP_ORE = 500 * ORE_PER_KRONE;
const LISTING_PRICE_STEP_ORE = 50 * ORE_PER_KRONE;

export const REVENUE_ESTIMATE_NOTE =
	"Inntektene er estimater basert på listepris. De tar ikke hensyn til rabatter, særavtaler eller hva som faktisk er fakturert.";

export type SalesKpi = {
	label: string;
	value: string;
	change: number | null;
	suffix: string;
};

function roundToStep(ore: number, step: number) {
	return Math.round(ore / step) * step;
}

export function comparisonSuffix(overview: SalesOverview, allSemesters: boolean): string {
	if (allSemesters) return "siste fem år";
	if (!overview.comparedWith) return "ingen sammenligning";
	const label = semesterLabel(overview.comparedWith).toLowerCase();
	return overview.comparedToDate ? `mot samme dato i ${label}` : `mot ${label}`;
}

function companiesDetail(overview: SalesOverview, allSemesters: boolean): string {
	const { returningCompanies } = overview;
	if (allSemesters) return `${returningCompanies} har kjøpt mer enn én gang`;
	const paying = overview.totals.payingCompanies;
	const share = paying === 0 ? 0 : (returningCompanies / paying) * 100;
	return `${returningCompanies} tilbakevendende, ${formatPercent(share)}`;
}

export function salesKpis(overview: SalesOverview, allSemesters: boolean): SalesKpi[] {
	const { totals, previous } = overview;
	const suffix = comparisonSuffix(overview, allSemesters);
	const averagePrice = totals.averagePresentationPriceOre ?? 0;
	const averageListing = totals.averageJobListingPriceOre ?? 0;

	return [
		{
			label: "Inntekt eks. mva.",
			value: formatNok(totals.revenueOre),
			change: percentChange(totals.revenueOre, previous?.revenueOre ?? null),
			suffix,
		},
		{
			label: "Arrangementer solgt",
			value: formatCount(totals.eventsSold),
			change: percentChange(totals.eventsSold, previous?.eventsSold ?? null),
			suffix,
		},
		{
			label: "Snittpris bedriftspresentasjon",
			value: formatNok(roundToStep(averagePrice, PRESENTATION_PRICE_STEP_ORE)),
			change: percentChange(averagePrice, previous?.averagePresentationPriceOre ?? null),
			suffix,
		},
		{
			label: "Betalende bedrifter",
			value: formatCount(totals.payingCompanies),
			change: null,
			suffix: companiesDetail(overview, allSemesters),
		},
		{
			label: "Stillingsannonser",
			value: formatCount(totals.jobListings),
			change: null,
			suffix: `${formatNok(totals.jobListingRevenueOre)}, snitt ${formatNok(roundToStep(averageListing, LISTING_PRICE_STEP_ORE))}`,
		},
	];
}

export function guessedWarning(
	guessedEvents: number,
	eventsSold: number,
	scopeLabel: string,
): string | null {
	if (guessedEvents === 0) return null;
	return `${guessedEvents} av ${eventsSold} arrangementer i ${scopeLabel.toLowerCase()} har et gjettet produkt, så tallene kan være feil.`;
}
