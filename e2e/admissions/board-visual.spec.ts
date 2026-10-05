import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import { bifrostUrl, clearCookieNotice, resetAdmissions } from "./production-helpers";

test("keeps board controls in the viewport and shows interviewer photos in both themes", async ({
	page,
}) => {
	await resetAdmissions("scheduled");
	await page.goto(`${bifrostUrl}/admissions`);
	await clearCookieNotice(page);
	for (const mode of ["Light", "Dark"]) {
		await page.getByRole("button", { name: "Velg fargetema", exact: true }).click();
		await page.getByRole("menuitemradio", { name: mode, exact: true }).click();
		await expect(page.getByRole("img", { name: "Kristin Berg", exact: true })).toBeVisible();
		await expect(page.getByRole("img", { name: "Daniel Holm", exact: true })).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		).toBe(true);
		await captureScreenshot(
			page,
			"board",
			`live-16-calendar-${mode.toLowerCase()}.png`,
			page.getByRole("heading", { name: "Opptak", exact: true }),
			{ width: 1440, height: 1000 },
		);
	}
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	);
	await captureScreenshot(
		page,
		"board",
		"live-17-mobile.png",
		page.getByRole("heading", { name: "Opptak", exact: true }),
	);
});
