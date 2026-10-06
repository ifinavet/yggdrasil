import { expect, type Page, test } from "@playwright/test";
import { bifrostUrl, clearCookieNotice, convexUrl } from "./production-helpers";
import { type JobListingSeedScenario, seedJobListings } from "./seed-job-listings";

function hint(page: Page, text: RegExp) {
	return page.getByRole("dialog", { name: text });
}

async function openListings(page: Page, scenario: JobListingSeedScenario) {
	await seedJobListings(convexUrl, scenario);
	await page.goto(`${bifrostUrl}/job-listings`);
	await clearCookieNotice(page);
}

const orders = /Åpne en bestilling/;
const search = /Søket gjelder også utløpte annonser/;
const create = /Lag en annonse selv/;
const publish = /Upubliserte annonser vises ikke/;
const expired = /Åpne for å se annonser med utløpt frist/;

test.describe("job listings guide", () => {
	test.describe.configure({ mode: "serial" });
	test.use({ storageState: { cookies: [], origins: [] } });

	test("only shows hints for elements on the page", async ({ page }) => {
		await openListings(page, "empty");
		await expect(hint(page, search)).toBeVisible();
		await hint(page, search).getByRole("button", { name: "Skjønner" }).click();
		await expect(hint(page, create)).toBeVisible();
		await hint(page, create).getByRole("button", { name: "Skjønner" }).click();
		await expect(page.locator("[role=dialog]")).toHaveCount(0);
		await expect(page.locator('[data-tour="orders"], [data-tour="expired"]')).toHaveCount(0);
		await expect(page.locator('[data-tour="publish"]')).toHaveCount(0);
	});

	test("walks through every step in order and stays away once seen", async ({ page }) => {
		await openListings(page, "full");
		for (const step of [orders, search, create, publish, expired]) {
			await expect(hint(page, step)).toBeVisible();
			await hint(page, step).getByRole("button", { name: "Skjønner" }).click();
			await expect(hint(page, step)).toBeHidden();
		}
		await page.reload();
		await expect(page.locator('[data-tour="expired"]')).toBeVisible();
		await expect(page.locator("[role=dialog]")).toHaveCount(0);
		await page.getByRole("button", { name: "Vis veiledningen igjen" }).click();
		await expect(hint(page, orders)).toBeVisible();
	});

	test("skips the order hint when no order is waiting", async ({ page }) => {
		await openListings(page, "listings");
		await expect(hint(page, search)).toBeVisible();
		await expect(hint(page, orders)).toBeHidden();
	});

	test("using the highlighted control moves the guide on", async ({ page }) => {
		await openListings(page, "full");
		await hint(page, orders).getByRole("button", { name: "Skjønner" }).click();
		await expect(hint(page, search)).toBeVisible();
		await page.getByPlaceholder("Tittel, bedrift eller type").click();
		await expect(hint(page, search)).toBeHidden();
		await expect(hint(page, create)).toBeVisible();
	});

	test("keeps every hint on screen at phone width", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openListings(page, "full");
		for (const step of [orders, search, create, publish, expired]) {
			await expect(hint(page, step)).toBeInViewport({ ratio: 1 });
			await hint(page, step).getByRole("button", { name: "Skjønner" }).click();
		}
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
	});
});
