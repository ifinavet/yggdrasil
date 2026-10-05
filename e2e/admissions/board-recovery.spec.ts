import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	resetAdmissions,
} from "./production-helpers";

test("seeded failed reminders retry the same native workflows without duplicating jobs", async ({
	page,
}) => {
	await resetAdmissions("delivery-failed");
	const before = (await admissionsOverview())?.jobs;
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
	await expect
		.poll(async () => (await admissionsOverview())?.jobs.map((job) => job.state))
		.toEqual(["inProgress", "inProgress"]);
	expect((await admissionsOverview())?.jobs.map((job) => job.workflowId)).toEqual(
		before?.map((job) => job.workflowId),
	);
	await page.reload();
	await expect(page.getByRole("heading", { name: "Opptak", exact: true })).toBeVisible();
	expect((await admissionsOverview())?.jobs).toHaveLength(2);
});
