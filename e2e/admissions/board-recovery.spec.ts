import { expect, test } from "@playwright/test";
import { captureEmail, captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	resetAdmissions,
} from "./production-helpers";

test("failed reminders are visible and can be retried without duplicate delivery", async ({
	page,
}) => {
	await resetAdmissions("delivery-failed");
	await page.goto(`${bifrostUrl}/admissions`);
	await clearCookieNotice(page);
	await expect(page.getByRole("button", { name: "Prøv igjen", exact: true })).toHaveCount(2);
	await captureScreenshot(
		page,
		"board",
		"live-18-delivery-failure.png",
		page.getByRole("heading", { name: "Opptak", exact: true }),
	);
	await page.getByRole("button", { name: "Prøv igjen", exact: true }).first().click();
	await expect(page.getByRole("button", { name: "Prøv igjen", exact: true })).toHaveCount(1);
	await page.getByRole("button", { name: "Prøv igjen", exact: true }).click();
	await expect(page.getByRole("button", { name: "Prøv igjen", exact: true })).toHaveCount(0);
	await expect.poll(async () => (await admissionsOverview())?.localEmails.length).toBe(2);
	const emails = (await admissionsOverview())?.localEmails ?? [];
	for (const [index, mail] of emails.entries()) {
		await captureEmail(page, "student", `live-reminder-${index + 1}-email.png`, mail.html);
	}
	await page.reload();
	await expect(page.getByRole("heading", { name: "Opptak", exact: true })).toBeVisible();
	expect((await admissionsOverview())?.localEmails).toHaveLength(2);
});
