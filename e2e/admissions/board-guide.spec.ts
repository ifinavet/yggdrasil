import { expect, type Page, test } from "@playwright/test";
import { bifrostUrl, clearCookieNotice, resetAdmissions } from "./production-helpers";

function hint(page: Page, text: string) {
	return page.getByRole("dialog", { name: text });
}

test.describe("admissions guide", () => {
	test.describe.configure({ mode: "serial" });
	test.use({ storageState: { cookies: [], origins: [] } });

	test("shows no hint before an admission exists", async ({ page }) => {
		await resetAdmissions("empty");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(page.getByRole("button", { name: "Start opptak" })).toBeVisible();
		await expect(page.locator("[data-tour]")).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Vis veiledningen igjen" })).toHaveCount(0);
	});

	test("a dismissed hint stays away until replayed", async ({ page }) => {
		await resetAdmissions("open");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		const calendars = hint(page, /Velg hvilke Google-kalendere/);
		await expect(calendars).toBeVisible();

		await calendars.getByRole("button", { name: "Skjønner" }).click();
		await expect(calendars).toBeHidden();
		await page.reload();
		await expect(page.locator('[data-tour="calendars"]')).toBeVisible();
		await expect(calendars).toBeHidden();

		await page.getByRole("button", { name: "Vis veiledningen igjen" }).click();
		await expect(calendars).toBeVisible();
	});

	test("moves on to the next setup button once the current one is used", async ({ page }) => {
		await resetAdmissions("open");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		const calendars = hint(page, /Velg hvilke Google-kalendere/);
		await expect(calendars).toBeVisible();

		await page.locator('[data-tour="calendars"]').click();
		const dialog = page.getByRole("dialog", { name: "Kalendere" });
		await expect(dialog).toBeVisible();
		await expect(calendars).toBeHidden();
		await dialog.getByRole("button", { name: "Close" }).click();
		await expect(hint(page, /Lager et forslag til intervjuplan/)).toBeVisible();
	});

	test("skips straight to approval when a plan already exists", async ({ page }) => {
		await resetAdmissions("planned");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(hint(page, /Godkjenn når forslaget ser riktig ut/)).toBeVisible();
		await expect(hint(page, /Velg hvilke Google-kalendere/)).toBeHidden();
	});

	test("keeps the hint on screen at phone width", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await resetAdmissions("open");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		const calendars = hint(page, /Velg hvilke Google-kalendere/);
		await expect(calendars).toBeInViewport({ ratio: 1 });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
	});
});
