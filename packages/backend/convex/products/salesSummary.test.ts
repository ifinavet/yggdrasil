import {
	compactSemesterLabel,
	companyActivity,
	companyHistories,
	isJobListingSale,
	jobListingSales,
	lapsedCompanies,
	percentChange,
	previousSemesters,
	productMix,
	productSalesSummary,
	revenuePerSemester,
	type Sale,
	type SemesterRef,
	salesInSemester,
	salesInWindow,
	salesOverview,
	salesTotals,
	sameSemesterLastYear,
	semesterAbbreviation,
	semesterFromKey,
	semesterKey,
	semesterLabel,
	statsWindow,
} from "@workspace/shared/products";
import { describe, expect, it } from "vitest";

const VAR_2027: SemesterRef = { semester: "vår", year: 2027 };
const HOST_2027: SemesterRef = { semester: "høst", year: 2027 };

const baseSale: Sale = {
	semester: "vår",
	year: 2027,
	productId: "p1",
	productName: "Produkt A",
	category: "event",
	companyId: "c1",
	companyName: "Bedrift A",
	quantity: 1,
	revenueOre: 100,
	guessed: false,
	soldAt: Date.parse("2027-03-01T10:00:00Z"),
};

const sale = (overrides: Partial<Sale>): Sale => ({ ...baseSale, ...overrides });

describe("semester helpers", () => {
	it("combines year and semester index into a key", () => {
		expect(semesterKey(VAR_2027)).toBe("2027-0");
		expect(semesterKey(HOST_2027)).toBe("2027-1");
	});

	it("formats full, abbreviated and compact labels", () => {
		expect(semesterLabel(HOST_2027)).toBe("Høst 2027");
		expect(semesterAbbreviation(VAR_2027)).toBe("V27");
		expect(compactSemesterLabel(HOST_2027)).toBe("Høst 27");
	});

	it("round trips a key", () => {
		expect(semesterFromKey(semesterKey(VAR_2027))).toEqual(VAR_2027);
	});

	it("walks backwards across a year boundary", () => {
		expect(previousSemesters(VAR_2027, 3)).toEqual([
			VAR_2027,
			{ semester: "høst", year: 2026 },
			{ semester: "vår", year: 2026 },
		]);
	});

	it("builds a ten semester window ending in the current one, oldest first", () => {
		const window = statsWindow(HOST_2027);
		expect(window).toHaveLength(10);
		expect(window[0]).toEqual({ semester: "vår", year: 2023 });
		expect(window.at(-1)).toEqual(HOST_2027);
	});

	it("finds the same semester last year", () => {
		expect(sameSemesterLastYear(HOST_2027)).toEqual({ semester: "høst", year: 2026 });
	});
});

describe("jobListingSales", () => {
	const product = {
		productId: "p1",
		productName: "Stillingsannonse",
		category: "job_listing" as const,
		volumeTiers: [
			{ quantity: 1, totalPriceOre: 300_000 },
			{ quantity: 2, totalPriceOre: 550_000 },
		],
	};
	const listing = { ...VAR_2027, companyId: "c1", companyName: "Bedrift", guessed: false };

	it("groups listings per company and semester, pricing by quantity", () => {
		const sales = jobListingSales(
			[
				{ ...listing, soldAt: 2000 },
				{ ...listing, soldAt: 1000, guessed: true },
				{ ...listing, ...HOST_2027, soldAt: 3000 },
			],
			product,
		);
		expect(sales).toEqual([
			{
				...VAR_2027,
				productId: "p1",
				productName: "Stillingsannonse",
				category: "job_listing",
				companyId: "c1",
				companyName: "Bedrift",
				quantity: 2,
				revenueOre: 550_000,
				guessed: true,
				soldAt: 2000,
			},
			{
				...HOST_2027,
				productId: "p1",
				productName: "Stillingsannonse",
				category: "job_listing",
				companyId: "c1",
				companyName: "Bedrift",
				quantity: 1,
				revenueOre: 300_000,
				guessed: false,
				soldAt: 3000,
			},
		]);
	});

	it("prices at zero without any volume tiers", () => {
		const sales = jobListingSales([{ ...listing, soldAt: 1 }], { ...product, volumeTiers: [] });
		expect(sales[0]?.revenueOre).toBe(0);
	});
});

describe("sale filters", () => {
	const sales = [baseSale, sale({ ...HOST_2027, companyId: "c2" }), sale({ year: 2020 })];

	it("returns everything for a null semester key", () => {
		expect(salesInSemester(sales, null)).toEqual(sales);
	});

	it("filters by semester key", () => {
		expect(salesInSemester(sales, "2027-1")).toEqual([sales[1]]);
	});

	it("keeps only sales inside the window", () => {
		expect(salesInWindow(sales, [VAR_2027, HOST_2027])).toEqual([sales[0], sales[1]]);
	});

	it("recognises job listing sales", () => {
		expect(isJobListingSale({ category: "job_listing" })).toBe(true);
		expect(isJobListingSale({ category: "event" })).toBe(false);
	});
});

describe("salesTotals", () => {
	it("splits events from job listings", () => {
		const totals = salesTotals([
			sale({ revenueOre: 2000 }),
			sale({ revenueOre: 4000, companyId: "c2", guessed: true }),
			sale({ category: "external_event", revenueOre: 1000, companyId: "c3" }),
			sale({ category: "other", revenueOre: 0, companyId: "c4" }),
			sale({ category: "job_listing", quantity: 3, revenueOre: 900 }),
		]);
		expect(totals).toEqual({
			revenueOre: 7900,
			eventsSold: 4,
			guessedEvents: 1,
			averagePresentationPriceOre: 3000,
			payingCompanies: 3,
			jobListings: 3,
			jobListingRevenueOre: 900,
			averageJobListingPriceOre: 300,
		});
	});

	it("has no averages without priced sales", () => {
		const totals = salesTotals([sale({ revenueOre: 0 })]);
		expect(totals.averagePresentationPriceOre).toBeNull();
		expect(totals.averageJobListingPriceOre).toBeNull();
		expect(totals.payingCompanies).toBe(0);
	});
});

describe("percentChange", () => {
	it("computes the relative change", () => {
		expect(percentChange(150, 100)).toBe(50);
		expect(percentChange(50, 100)).toBe(-50);
	});

	it("has no change without a previous value", () => {
		expect(percentChange(100, null)).toBeNull();
		expect(percentChange(100, 0)).toBeNull();
	});
});

describe("salesOverview", () => {
	const window = [{ semester: "høst", year: 2026 } as const, VAR_2027, HOST_2027];

	it("sums the whole window and counts companies buying in several semesters", () => {
		const sales = [
			sale({ semester: "høst", year: 2026 }),
			sale({}),
			sale({ companyId: "c2" }),
			sale({ year: 2020, companyId: "c2" }),
		];
		const overview = salesOverview(sales, window, null);
		expect(overview.totals.revenueOre).toBe(300);
		expect(overview.previous).toBeNull();
		expect(overview.comparedWith).toBeNull();
		expect(overview.returningCompanies).toBe(1);
	});

	it("compares a finished semester with the whole same semester last year", () => {
		const sales = [
			sale({ revenueOre: 300 }),
			sale({ year: 2026, revenueOre: 100, soldAt: Date.parse("2026-06-01T00:00:00Z") }),
			sale({ companyId: "c2", revenueOre: 50 }),
		];
		const overview = salesOverview(sales, window, "2027-0");
		expect(overview.totals.revenueOre).toBe(350);
		expect(overview.previous?.revenueOre).toBe(100);
		expect(overview.comparedWith).toEqual({ semester: "vår", year: 2026 });
		expect(overview.returningCompanies).toBe(1);
	});

	it("compares the running semester with the whole same semester last year", () => {
		const sales = [
			sale({ ...HOST_2027, revenueOre: 300 }),
			sale({ semester: "høst", year: 2026, soldAt: Date.parse("2026-09-01T00:00:00Z") }),
			sale({
				semester: "høst",
				year: 2026,
				revenueOre: 900,
				soldAt: Date.parse("2026-11-01T00:00:00Z"),
			}),
		];
		const overview = salesOverview(sales, window, "2027-1");
		expect(overview.previous?.revenueOre).toBe(1000);
	});

	it("has no comparison when last year sold nothing", () => {
		const overview = salesOverview([sale(HOST_2027)], window, "2027-1");
		expect(overview.previous).toBeNull();
		expect(overview.comparedWith).toBeNull();
		expect(overview.returningCompanies).toBe(0);
	});
});

describe("revenuePerSemester", () => {
	it("splits revenue by series with a four semester rolling average", () => {
		const window = statsWindow(HOST_2027).slice(-5);
		const sales = window.map((semester, index) =>
			sale({ ...semester, revenueOre: (index + 1) * 100 }),
		);
		sales.push(sale({ ...HOST_2027, category: "job_listing", revenueOre: 500 }));
		const rows = revenuePerSemester(sales, window);
		expect(rows.map((row) => row.rollingAverageOre)).toEqual([null, null, null, 250, 475]);
		expect(rows.at(-1)).toMatchObject({
			key: "2027-1",
			label: "Høst 2027",
			revenueOre: 1000,
			bySeries: { event: 500, external_event: 0, job_listing: 500, other: 0 },
		});
	});
});

describe("productMix", () => {
	it("sums per product, sorted by revenue then name", () => {
		const rows = productMix([
			sale({ productId: "p1", productName: "B", revenueOre: 100 }),
			sale({ productId: "p2", productName: "A", revenueOre: 100 }),
			sale({ productId: "p3", productName: "C", revenueOre: 150 }),
			sale({ productId: "p3", productName: "C", revenueOre: 150 }),
		]);
		expect(rows.map((row) => [row.productName, row.quantity, row.revenueOre])).toEqual([
			["C", 2, 300],
			["A", 1, 100],
			["B", 1, 100],
		]);
	});
});

describe("companyActivity", () => {
	it("splits paying companies into new and returning per semester", () => {
		const sales = [
			sale({ companyId: "c1", year: 2026 }),
			sale({ companyId: "c1" }),
			sale({ companyId: "c2" }),
			sale({ companyId: "c3", revenueOre: 0 }),
		];
		expect(companyActivity(sales, [{ semester: "vår", year: 2026 }, VAR_2027])).toEqual([
			{ semester: "vår", year: 2026, key: "2026-0", returning: 0, new: 1 },
			{ ...VAR_2027, key: "2027-0", returning: 1, new: 1 },
		]);
	});
});

describe("companyHistories", () => {
	const window = [{ semester: "høst", year: 2026 } as const, VAR_2027, HOST_2027];

	it("builds per company revenue, activity and first purchase", () => {
		const histories = companyHistories(
			[
				sale({ companyId: "c1", companyName: "Bedrift A", year: 2020, revenueOre: 999 }),
				sale({ companyId: "c1", companyName: "Bedrift A", revenueOre: 100 }),
				sale({ companyId: "c1", companyName: "Bedrift A", ...HOST_2027, revenueOre: 200 }),
				sale({ companyId: "c2", companyName: "Bedrift B", revenueOre: 300 }),
				sale({ companyId: "c3", companyName: "Bedrift C", revenueOre: 300 }),
				sale({ companyId: "c4", companyName: "Bedrift D", revenueOre: 0 }),
			],
			window,
		);
		expect(histories.map((history) => history.companyName)).toEqual([
			"Bedrift A",
			"Bedrift B",
			"Bedrift C",
		]);
		expect(histories[0]).toEqual({
			companyId: "c1",
			companyName: "Bedrift A",
			revenueBySemester: { "2026-1": 0, "2027-0": 100, "2027-1": 200 },
			activeSemesters: 2,
			totalOre: 300,
			lastPurchase: HOST_2027,
			customerSince: { semester: "vår", year: 2020 },
		});
	});

	it("flags companies that have not bought in the last two semesters", () => {
		const longWindow = statsWindow(HOST_2027);
		const histories = companyHistories(
			[
				sale({ companyId: "c1", semester: "vår", year: 2026 }),
				sale({ companyId: "c2", semester: "høst", year: 2026 }),
			],
			longWindow,
		);
		expect(lapsedCompanies(histories, longWindow).map((history) => history.companyId)).toEqual([
			"c1",
		]);
	});
});

describe("productSalesSummary", () => {
	const window = [VAR_2027, HOST_2027];

	it("counts one product per semester and its share of revenue", () => {
		const summary = productSalesSummary(
			[
				sale({ productId: "p1", quantity: 2, revenueOre: 300 }),
				sale({ productId: "p1", ...HOST_2027, revenueOre: 100 }),
				sale({ productId: "p2", revenueOre: 600 }),
				sale({ productId: "p1", year: 2020, revenueOre: 5000 }),
			],
			window,
			"p1",
		);
		expect(summary).toEqual({
			quantityBySemester: [
				{ semester: VAR_2027, quantity: 2 },
				{ semester: HOST_2027, quantity: 1 },
			],
			quantity: 3,
			revenueOre: 400,
			shareOfRevenue: 40,
		});
	});

	it("has no share without any revenue", () => {
		expect(productSalesSummary([], window, "p1").shareOfRevenue).toBeNull();
	});
});
