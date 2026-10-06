import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	clearCookieNotice,
	convexUrl,
	huginUrl,
	resetAdmissions,
} from "./production-helpers";
import { LocalDatabase } from "./seed-database";

for (const state of ["rejected", "waiting", "not-open"] as const) {
	test(`applicant sees ${state} without unavailable actions`, async ({ page }) => {
		await resetAdmissions("scheduled");
		const overview = await admissionsOverview();
		if (!overview) throw new Error("Missing period");
		const db = new LocalDatabase(convexUrl);
		const candidate = overview.candidates.find((row) => row.name === "Local Developer");
		if (!candidate) throw new Error("Missing local applicant");
		await db.clear("admissionInterviews");
		if (state === "rejected")
			await db.patch("admissionApplications", candidate._id, {
				decision: "rejected",
				decisionSentAt: Date.now(),
			});
		if (state === "waiting")
			await db.patch("admissionPeriods", overview.period._id, {
				applicationEndAt: Date.now() - 1000,
			});
		if (state === "not-open") {
			await db.delete("admissionApplications", candidate._id);
			await db.patch("admissionPeriods", overview.period._id, {
				applicationStartAt: Date.now() + 60_000,
			});
		}
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		const title =
			state === "rejected"
				? "Takk for at du søkte"
				: state === "waiting"
					? "Søknaden din er sendt"
					: "Søknadsperioden er avsluttet";
		await expect(page.getByRole("heading", { name: title })).toBeVisible();
		await expect(page.getByRole("button", { name: "Rediger søknaden" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Takk ja", exact: true })).toHaveCount(0);
		await captureScreenshot(page, "student", `live-21-${state}.png`, page.getByRole("main"));
	});
}

test("draft survives reload and submission requires profile confirmation and consent on mobile", async ({
	page,
}) => {
	await resetAdmissions("open");
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${huginUrl}/admissions`);
	await clearCookieNotice(page);
	await expect(page.getByRole("heading", { name: "Bli med i Navet" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Send søknad" })).toBeDisabled();
	await captureScreenshot(
		page,
		"student",
		"live-22-mobile-profile.png",
		page.getByRole("heading", { name: "Bli med i Navet" }),
	);
	await page.getByRole("button", { name: "Ja", exact: true }).click();
	await page
		.getByLabel("Fortell litt om deg selv")
		.fill("Utkastet skal finnes igjen etter at siden lastes på nytt.");
	await page.getByRole("button", { name: "Lagre utkast" }).click();
	await expect(page.getByText("Utkastet er lagret.", { exact: true })).toBeVisible();
	await captureScreenshot(
		page,
		"student",
		"live-23-draft-saved.png",
		page.getByRole("button", { name: "Lagre utkast" }),
	);
	await page.reload();
	await expect(page.getByLabel("Fortell litt om deg selv")).toHaveValue(
		"Utkastet skal finnes igjen etter at siden lastes på nytt.",
	);
	await expect(page.getByRole("button", { name: "Send søknad" })).toBeDisabled();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	);
});
