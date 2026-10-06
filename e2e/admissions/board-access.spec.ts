import { expect, test } from "@playwright/test";
import { localIdentity } from "@workspace/shared/local";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	convexUrl,
	resetAdmissions,
} from "./production-helpers";
import { LocalDatabase } from "./seed-database";

for (const role of ["admin", "editor", "internal"] as const) {
	test(`${role} receives the correct admissions access in UI and API`, async ({ page }) => {
		await resetAdmissions("scheduled");
		const db = new LocalDatabase(convexUrl);
		const user = await db.find("users", "externalId", localIdentity.subject);
		if (!user) throw new Error("Missing local user");
		const rights = await db.find("accessRights", "userId", user._id);
		if (!rights) throw new Error("Missing local role");
		await db.patch("accessRights", rights._id, { role });
		try {
			await page.goto(`${bifrostUrl}/admissions`);
			await clearCookieNotice(page);
			if (role === "admin") {
				await expect(page.getByRole("heading", { name: "Opptak", exact: true })).toBeVisible();
				expect(await admissionsOverview()).not.toBeNull();
				await captureScreenshot(
					page,
					"board",
					"live-33-board-member-access.png",
					page.getByRole("heading", { name: "Opptak", exact: true }),
				);
			} else {
				await expect(page).not.toHaveURL(/\/admissions$/);
				await expect(page.getByRole("link", { name: "Opptak", exact: true })).toHaveCount(0);
				await expect(admissionsOverview()).rejects.toThrow(/Unauthorized/);
				await captureScreenshot(
					page,
					"board",
					`live-34-${role}-denied.png`,
					page.getByRole("main").last(),
				);
			}
		} finally {
			await db.patch("accessRights", rights._id, { role: rights.role });
		}
	});
}
