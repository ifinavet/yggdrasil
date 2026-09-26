import { subYears } from "date-fns";
import {
	EVENT_SEMESTER_LABELS,
	EVENT_SEMESTERS,
	type EventSemester,
	eventSemesterOf,
} from "../time/event-semester";
import type { ProductCategory } from "./categories";
import { tierTotalOre, type VolumeTier } from "./money";

export type SemesterRef = { semester: EventSemester; year: number };

export type Sale = SemesterRef & {
	productId: string;
	productName: string;
	category: ProductCategory;
	companyId: string;
	companyName: string;
	mainSponsor: boolean;
	quantity: number;
	revenueOre: number;
	guessed: boolean;
	soldAt: number;
};

export const STATS_WINDOW_SIZE = 10;
export const ROLLING_AVERAGE_SIZE = 4;
export const LAPSED_AFTER_SEMESTERS = 2;
export const RECENT_SEMESTERS = 4;

export function semesterKey({ semester, year }: SemesterRef): string {
	return `${year}-${EVENT_SEMESTERS.indexOf(semester)}`;
}

export function semesterLabel({ semester, year }: SemesterRef): string {
	return `${EVENT_SEMESTER_LABELS[semester]} ${year}`;
}

function twoDigitYear(year: number): string {
	return String(year).slice(-2);
}

export function semesterAbbreviation({ semester, year }: SemesterRef): string {
	return `${EVENT_SEMESTER_LABELS[semester].charAt(0)}${twoDigitYear(year)}`;
}

export function compactSemesterLabel({ semester, year }: SemesterRef): string {
	return `${EVENT_SEMESTER_LABELS[semester]} ${twoDigitYear(year)}`;
}

export function semesterFromKey(key: string): SemesterRef {
	const [year, index] = key.split("-").map(Number);
	return { semester: EVENT_SEMESTERS[index as number] as EventSemester, year: year as number };
}

export function previousSemesters(from: SemesterRef, count: number): SemesterRef[] {
	const semesters: SemesterRef[] = [];
	let current = from;
	for (let index = 0; index < count; index++) {
		semesters.push(current);
		current =
			current.semester === "høst"
				? { semester: "vår", year: current.year }
				: { semester: "høst", year: current.year - 1 };
	}
	return semesters;
}

export function statsWindow(current: SemesterRef): SemesterRef[] {
	return previousSemesters(current, STATS_WINDOW_SIZE).reverse();
}

export function sameSemesterLastYear({ semester, year }: SemesterRef): SemesterRef {
	return { semester, year: year - 1 };
}

export type SoldListing = SemesterRef & {
	companyId: string;
	companyName: string;
	mainSponsor: boolean;
	soldAt: number;
	guessed: boolean;
};

export function jobListingSales(
	listings: readonly SoldListing[],
	product: {
		productId: string;
		productName: string;
		category: ProductCategory;
		volumeTiers: readonly VolumeTier[];
	},
): Sale[] {
	const byCompanyAndSemester = new Map<string, Sale>();
	for (const listing of listings) {
		const key = `${listing.companyId}:${semesterKey(listing)}`;
		const sale = byCompanyAndSemester.get(key);
		if (sale) {
			sale.quantity += 1;
			sale.soldAt = Math.max(sale.soldAt, listing.soldAt);
			sale.guessed ||= listing.guessed;
		} else {
			byCompanyAndSemester.set(key, {
				semester: listing.semester,
				year: listing.year,
				productId: product.productId,
				productName: product.productName,
				category: product.category,
				companyId: listing.companyId,
				companyName: listing.companyName,
				mainSponsor: listing.mainSponsor,
				quantity: 1,
				revenueOre: 0,
				guessed: listing.guessed,
				soldAt: listing.soldAt,
			});
		}
	}
	return [...byCompanyAndSemester.values()].map((sale) => ({
		...sale,
		revenueOre: tierTotalOre(product.volumeTiers, sale.quantity),
	}));
}

export function salesInSemester(sales: readonly Sale[], key: string | null): Sale[] {
	return key === null ? [...sales] : sales.filter((sale) => semesterKey(sale) === key);
}

export function withoutMainSponsor(sales: readonly Sale[]): Sale[] {
	return sales.filter((sale) => !sale.mainSponsor);
}

export function salesInWindow(sales: readonly Sale[], window: readonly SemesterRef[]): Sale[] {
	const keys = new Set(window.map(semesterKey));
	return sales.filter((sale) => keys.has(semesterKey(sale)));
}

export function isJobListingSale(sale: Pick<Sale, "category">): boolean {
	return sale.category === "job_listing";
}

const sumRevenue = (sales: readonly Sale[]) =>
	sales.reduce((sum, sale) => sum + sale.revenueOre, 0);
const sumQuantity = (sales: readonly Sale[]) => sales.reduce((sum, sale) => sum + sale.quantity, 0);

function payingCompanyIds(sales: readonly Sale[]): Set<string> {
	return new Set(sales.filter((sale) => sale.revenueOre > 0).map((sale) => sale.companyId));
}

export type SalesTotals = {
	revenueOre: number;
	eventsSold: number;
	guessedEvents: number;
	averagePresentationPriceOre: number | null;
	payingCompanies: number;
	jobListings: number;
	jobListingRevenueOre: number;
	averageJobListingPriceOre: number | null;
};

const average = (total: number, count: number) => (count === 0 ? null : total / count);

export function salesTotals(sales: readonly Sale[]): SalesTotals {
	const events = sales.filter((sale) => !isJobListingSale(sale));
	const listings = sales.filter(isJobListingSale);
	const pricedPresentations = events.filter(
		(sale) => sale.category === "event" && sale.revenueOre > 0,
	);
	const jobListings = sumQuantity(listings);
	const jobListingRevenueOre = sumRevenue(listings);
	return {
		revenueOre: sumRevenue(sales),
		eventsSold: sumQuantity(events),
		guessedEvents: sumQuantity(events.filter((sale) => sale.guessed)),
		averagePresentationPriceOre: average(
			sumRevenue(pricedPresentations),
			sumQuantity(pricedPresentations),
		),
		payingCompanies: payingCompanyIds(sales).size,
		jobListings,
		jobListingRevenueOre,
		averageJobListingPriceOre: average(jobListingRevenueOre, jobListings),
	};
}

export function percentChange(current: number, previous: number | null): number | null {
	if (!previous) return null;
	return ((current - previous) / previous) * 100;
}

export type SalesOverview = {
	totals: SalesTotals;
	previous: SalesTotals | null;
	comparedWith: SemesterRef | null;
	comparedToDate: boolean;
	returningCompanies: number;
};

function firstPurchaseKeys(sales: readonly Sale[]): Map<string, string> {
	const first = new Map<string, string>();
	for (const sale of sales) {
		if (sale.revenueOre <= 0) continue;
		const key = semesterKey(sale);
		const known = first.get(sale.companyId);
		if (known === undefined || key < known) first.set(sale.companyId, key);
	}
	return first;
}

function purchaseSemesterCounts(sales: readonly Sale[]): Map<string, Set<string>> {
	const semesters = new Map<string, Set<string>>();
	for (const sale of sales) {
		if (sale.revenueOre <= 0) continue;
		const keys = semesters.get(sale.companyId) ?? new Set<string>();
		keys.add(semesterKey(sale));
		semesters.set(sale.companyId, keys);
	}
	return semesters;
}

function returningIn(sales: readonly Sale[], key: string): number {
	const first = firstPurchaseKeys(sales);
	return [...payingCompanyIds(salesInSemester(sales, key))].filter(
		(companyId) => (first.get(companyId) as string) < key,
	).length;
}

export function salesOverview(
	sales: readonly Sale[],
	window: readonly SemesterRef[],
	selectedKey: string | null,
	now: number,
): SalesOverview {
	if (selectedKey === null) {
		const inWindow = salesInWindow(sales, window);
		return {
			totals: salesTotals(inWindow),
			previous: null,
			comparedWith: null,
			comparedToDate: false,
			returningCompanies: [...purchaseSemesterCounts(inWindow).values()].filter(
				(keys) => keys.size > 1,
			).length,
		};
	}

	const selected = semesterFromKey(selectedKey);
	const lastYear = sameSemesterLastYear(selected);
	const comparedToDate = semesterKey(eventSemesterOf(now)) === selectedKey;
	const cutoff = subYears(now, 1).getTime();
	const lastYearSales = salesInSemester(sales, semesterKey(lastYear)).filter(
		(sale) => !comparedToDate || sale.soldAt <= cutoff,
	);
	const hasComparison = salesInSemester(sales, semesterKey(lastYear)).length > 0;

	return {
		totals: salesTotals(salesInSemester(sales, selectedKey)),
		previous: hasComparison ? salesTotals(lastYearSales) : null,
		comparedWith: hasComparison ? lastYear : null,
		comparedToDate: hasComparison && comparedToDate,
		returningCompanies: returningIn(sales, selectedKey),
	};
}

export const REVENUE_SERIES = ["event", "external_event", "job_listing", "other"] as const;
export type RevenueSeries = (typeof REVENUE_SERIES)[number];

export type SemesterRevenue = SemesterRef & {
	key: string;
	label: string;
	revenueOre: number;
	bySeries: Record<RevenueSeries, number>;
	rollingAverageOre: number | null;
};

export function revenuePerSemester(
	sales: readonly Sale[],
	window: readonly SemesterRef[],
): SemesterRevenue[] {
	const rows = window.map((semester) => {
		const semesterSales = salesInSemester(sales, semesterKey(semester));
		const bySeries = Object.fromEntries(
			REVENUE_SERIES.map((series) => [
				series,
				sumRevenue(semesterSales.filter((sale) => sale.category === series)),
			]),
		) as Record<RevenueSeries, number>;
		return {
			...semester,
			key: semesterKey(semester),
			label: semesterLabel(semester),
			revenueOre: sumRevenue(semesterSales),
			bySeries,
			rollingAverageOre: null as number | null,
		};
	});
	return rows.map((row, index) => {
		if (index < ROLLING_AVERAGE_SIZE - 1) return row;
		const recent = rows.slice(index - ROLLING_AVERAGE_SIZE + 1, index + 1);
		const total = recent.reduce((sum, item) => sum + item.revenueOre, 0);
		return { ...row, rollingAverageOre: total / ROLLING_AVERAGE_SIZE };
	});
}

export type ProductMixRow = {
	productId: string;
	productName: string;
	category: ProductCategory;
	quantity: number;
	revenueOre: number;
};

export function productMix(sales: readonly Sale[]): ProductMixRow[] {
	const rows = new Map<string, ProductMixRow>();
	for (const sale of sales) {
		const row = rows.get(sale.productId) ?? {
			productId: sale.productId,
			productName: sale.productName,
			category: sale.category,
			quantity: 0,
			revenueOre: 0,
		};
		row.quantity += sale.quantity;
		row.revenueOre += sale.revenueOre;
		rows.set(sale.productId, row);
	}
	return [...rows.values()].sort(
		(a, b) => b.revenueOre - a.revenueOre || a.productName.localeCompare(b.productName, "nb"),
	);
}

export type CompanyActivity = SemesterRef & {
	key: string;
	returning: number;
	new: number;
};

export function companyActivity(
	sales: readonly Sale[],
	window: readonly SemesterRef[],
): CompanyActivity[] {
	const first = firstPurchaseKeys(sales);
	return window.map((semester) => {
		const key = semesterKey(semester);
		const paying = [...payingCompanyIds(salesInSemester(sales, key))];
		const fresh = paying.filter((companyId) => first.get(companyId) === key).length;
		return { ...semester, key, returning: paying.length - fresh, new: fresh };
	});
}

export type CompanyHistory = {
	companyId: string;
	companyName: string;
	revenueBySemester: Record<string, number>;
	activeSemesters: number;
	totalOre: number;
	lastPurchase: SemesterRef;
	customerSince: SemesterRef;
};

export function companyHistories(
	sales: readonly Sale[],
	window: readonly SemesterRef[],
): CompanyHistory[] {
	const first = firstPurchaseKeys(sales);
	const paidInWindow = salesInWindow(sales, window).filter((sale) => sale.revenueOre > 0);
	const histories = new Map<string, CompanyHistory>();
	for (const sale of paidInWindow) {
		const history = histories.get(sale.companyId) ?? {
			companyId: sale.companyId,
			companyName: sale.companyName,
			revenueBySemester: Object.fromEntries(window.map((semester) => [semesterKey(semester), 0])),
			activeSemesters: 0,
			totalOre: 0,
			lastPurchase: { semester: sale.semester, year: sale.year },
			customerSince: semesterFromKey(first.get(sale.companyId) as string),
		};
		const key = semesterKey(sale);
		history.revenueBySemester[key] = (history.revenueBySemester[key] as number) + sale.revenueOre;
		history.totalOre += sale.revenueOre;
		histories.set(sale.companyId, history);
	}
	for (const history of histories.values()) {
		const active = window.filter(
			(semester) => (history.revenueBySemester[semesterKey(semester)] as number) > 0,
		);
		history.activeSemesters = active.length;
		history.lastPurchase = active.at(-1) as SemesterRef;
	}
	return [...histories.values()].sort(
		(a, b) => b.totalOre - a.totalOre || a.companyName.localeCompare(b.companyName, "nb"),
	);
}

export function lapsedCompanies(
	histories: readonly CompanyHistory[],
	window: readonly SemesterRef[],
): CompanyHistory[] {
	const recentKeys = new Set(window.slice(-(LAPSED_AFTER_SEMESTERS + 1)).map(semesterKey));
	return histories.filter((history) => !recentKeys.has(semesterKey(history.lastPurchase)));
}

export type ProductSalesSummary = {
	quantityBySemester: { semester: SemesterRef; quantity: number }[];
	quantity: number;
	revenueOre: number;
	shareOfRevenue: number | null;
};

export function productSalesSummary(
	sales: readonly Sale[],
	window: readonly SemesterRef[],
	productId: string,
): ProductSalesSummary {
	const inWindow = salesInWindow(sales, window);
	const productSales = inWindow.filter((sale) => sale.productId === productId);
	const revenueOre = sumRevenue(productSales);
	const totalRevenue = sumRevenue(inWindow);
	return {
		quantityBySemester: window.map((semester) => ({
			semester,
			quantity: sumQuantity(salesInSemester(productSales, semesterKey(semester))),
		})),
		quantity: sumQuantity(productSales),
		revenueOre,
		shareOfRevenue: totalRevenue === 0 ? null : (revenueOre / totalRevenue) * 100,
	};
}
