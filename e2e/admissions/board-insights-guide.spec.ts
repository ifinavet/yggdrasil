import { expect, type Page, test } from "@playwright/test";
import { bifrostUrl, clearCookieNotice, convexUrl } from "./production-helpers";
import { type InsightSeedScenario, insightSeedTitles, seedInsights } from "./seed-insights";

function hint(page: Page, text: RegExp) {
	return page.getByRole("dialog", { name: text });
}

async function openInsights(page: Page, scenario: InsightSeedScenario) {
	await seedInsights(convexUrl, scenario);
	await page.goto(`${bifrostUrl}/insight`);
	await clearCookieNotice(page);
}

const prognosis = /Prognosen viser hvor mange vi venter/;
const select = /Trykk på et arrangement/;
const alerts = /Varsler kommer når et arrangement/;
const past = /finner du oppmøte og sene avmeldinger/;

test.describe("insight guide", () => {
	test.describe.configure({ mode: "serial" });
	test.use({ storageState: { cookies: [], origins: [] } });

	test("walks through every step in order and stays away once seen", async ({ page }) => {
		await openInsights(page, "full");
		for (const step of [prognosis, select, alerts, past]) {
			await expect(hint(page, step)).toBeVisible();
			await hint(page, step).getByRole("button", { name: "Skjønner" }).click();
			await expect(hint(page, step)).toBeHidden();
		}
		await page.reload();
		await expect(page.locator('[data-tour="past"]')).toBeVisible();
		await expect(page.locator("[role=dialog]")).toHaveCount(0);
		await page.getByRole("button", { name: "Vis veiledningen igjen" }).click();
		await expect(hint(page, prognosis)).toBeVisible();
	});

	test("only shows hints for elements on the page", async ({ page }) => {
		await openInsights(page, "single");
		await expect(hint(page, prognosis)).toBeVisible();
		await hint(page, prognosis).getByRole("button", { name: "Skjønner" }).click();
		await expect(hint(page, past)).toBeVisible();
		await hint(page, past).getByRole("button", { name: "Skjønner" }).click();
		await expect(page.locator("[role=dialog]")).toHaveCount(0);
	});

	test("only the tab hint remains when no event is upcoming", async ({ page }) => {
		await openInsights(page, "empty");
		await expect(hint(page, past)).toBeVisible();
		await expect(page.locator('[data-tour="prognosis"]')).toHaveCount(0);
	});

	test("using the highlighted control moves the guide on", async ({ page }) => {
		await openInsights(page, "full");
		await hint(page, prognosis).getByRole("button", { name: "Skjønner" }).click();
		await expect(hint(page, select)).toBeVisible();
		await page.getByRole("button", { name: insightSeedTitles.other }).click();
		await expect(hint(page, select)).toBeHidden();
		await expect(hint(page, alerts)).toBeVisible();
	});

	test("keeps every hint on screen at phone width", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openInsights(page, "full");
		for (const step of [prognosis, select, alerts, past]) {
			await expect(hint(page, step)).toBeInViewport({ ratio: 1 });
			await hint(page, step).getByRole("button", { name: "Skjønner" }).click();
		}
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
	});
});

test.describe("organizer accent", () => {
	test("marks only the events the signed-in user organizes", async ({ page }) => {
		await openInsights(page, "full");
		const accent = (title: string) =>
			page.getByRole("row").filter({ hasText: title }).locator("[data-slot=table-row-marker]");
		await expect(accent(insightSeedTitles.lead)).toHaveText("Du er ansvarlig");
		await expect(accent(insightSeedTitles.lead)).toHaveClass(/(^|\s)bg-primary(\s|$)/);
		await expect(accent(insightSeedTitles.helper)).toHaveText("Du er medansvarlig");
		await expect(accent(insightSeedTitles.helper)).toHaveClass(/(^|\s)bg-primary-light(\s|$)/);
		await expect(accent(insightSeedTitles.other)).toHaveCount(0);
	});

	test("expands to show the role on hover", async ({ page }) => {
		await openInsights(page, "full");
		const accent = page
			.getByRole("row")
			.filter({ hasText: insightSeedTitles.helper })
			.locator("[data-slot=table-row-marker]");
		const width = () => accent.evaluate((element) => element.getBoundingClientRect().width);
		expect(await width()).toBeLessThanOrEqual(10);
		await accent.hover();
		await expect.poll(width).toBeGreaterThan(80);
	});
});
