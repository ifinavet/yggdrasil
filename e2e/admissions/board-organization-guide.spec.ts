import { expect, type Page, test } from "@playwright/test";
import { bifrostUrl, clearCookieNotice, convexUrl } from "./production-helpers";
import { LocalDatabase } from "./seed-database";

function hint(page: Page, text: RegExp) {
	return page.getByRole("dialog", { name: text });
}

async function openOrganization(page: Page) {
	await page.goto(`${bifrostUrl}/organization`);
	await clearCookieNotice(page);
}

test.describe("organization guide", () => {
	test.describe.configure({ mode: "serial" });
	test.use({ storageState: { cookies: [], origins: [] } });

	test.beforeAll(async () => {
		await new LocalDatabase(convexUrl).call("iam/localSeed:seed", {});
	});

	test("walks through every step in order", async ({ page }) => {
		await openOrganization(page);
		const steps = [
			{ anchor: "board", text: /Velg hvem som har vervet/ },
			{ anchor: "add", text: /Skriv inn navn, UiO-e-post og Navet-e-post/ },
			{ anchor: "remove", text: /Trykk her for å fjerne en intern/ },
			{ anchor: "slack", text: /Slack-kontoen deaktiverer du selv/ },
		];
		for (const { anchor, text } of steps) {
			const current = hint(page, text);
			await expect(current).toBeVisible();
			await page.locator(`[data-tour="${anchor}"]`).scrollIntoViewIfNeeded();
			await current.getByRole("button", { name: "Skjønner" }).click();
			await expect(current).toBeHidden();
		}
		for (const { text } of steps) await expect(hint(page, text)).toBeHidden();
	});

	test("a dismissed hint stays away until replayed", async ({ page }) => {
		await openOrganization(page);
		const board = hint(page, /Velg hvem som har vervet/);
		await expect(board).toBeVisible();
		await board.getByRole("button", { name: "Skjønner" }).click();
		await page.reload();
		await expect(page.locator('[data-tour="board"]')).toBeVisible();
		await expect(board).toBeHidden();

		await page.getByRole("button", { name: "Vis veiledningen igjen" }).click();
		await expect(board).toBeVisible();
	});

	test("moves on once the highlighted button is used", async ({ page }) => {
		await openOrganization(page);
		await expect(hint(page, /Velg hvem som har vervet/)).toBeVisible();
		await page.locator('[data-tour="board"]').click();
		await page.keyboard.press("Escape");
		await expect(hint(page, /Velg hvem som har vervet/)).toBeHidden();
		await expect(hint(page, /Skriv inn navn, UiO-e-post og Navet-e-post/)).toBeVisible();
	});

	test("keeps the first hint on screen at phone width", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openOrganization(page);
		await expect(hint(page, /Velg hvem som har vervet/)).toBeInViewport({ ratio: 1 });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
	});
});
