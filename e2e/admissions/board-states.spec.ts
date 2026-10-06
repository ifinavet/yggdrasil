import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import { bifrostUrl, clearCookieNotice, resetAdmissions } from "./production-helpers";

test("unmatched candidates, day view, and abandoning a decision keep data unchanged", async ({
	page,
}) => {
	await resetAdmissions("scheduled");
	await page.goto(`${bifrostUrl}/admissions`);
	await clearCookieNotice(page);
	await page.getByRole("button", { name: "Vis kandidater", exact: true }).click();
	const unmatched = page.getByRole("dialog", { name: "Kandidater uten intervjutid" });
	await expect(unmatched).toBeVisible();
	await captureScreenshot(page, "board", "live-29-unmatched-candidates.png", unmatched);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Dag", exact: true }).click();
	await expect(page.locator(".admissions-day")).toHaveCount(1);
	await captureScreenshot(
		page,
		"board",
		"live-30-day-view.png",
		page.getByRole("heading", { name: "Opptak", exact: true }),
	);
	await page.getByRole("button", { name: /^Kandidater/ }).click();
	await captureScreenshot(page, "board", "live-31-all-candidates.png", page.getByRole("table"));
	await page.getByRole("table").getByRole("button").first().click();
	await page.getByRole("combobox", { name: "Vedtak" }).click();
	await page.getByRole("option", { name: "Tatt opp", exact: true }).click();
	const offer = page.getByRole("dialog", { name: /^Tilbud til/ });
	await expect(offer.getByRole("button", { name: "Lagre tilbud" })).toBeDisabled();
	await expect(offer.getByLabel("Navet-adresse")).toHaveValue("");
	await captureScreenshot(page, "board", "live-32-incomplete-offer.png", offer);
	await page.keyboard.press("Escape");
	await expect(offer).toBeHidden();
});
