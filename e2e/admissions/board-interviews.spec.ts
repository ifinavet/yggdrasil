import { expect, test } from "@playwright/test";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	resetAdmissions,
} from "./production-helpers";

test.describe("manual interview follow-up", () => {
	test("saves a manually confirmed interview without publishing it", async ({ page }) => {
		await resetAdmissions("open");
		const initial = await admissionsOverview();
		const candidate = initial?.candidates.find((row) => row.availability.length === 0);
		expect(candidate).toBeDefined();
		const day = initial?.candidates.flatMap((row) => row.availability)[0]?.day ?? "";
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: /^Kandidater/ }).click();
		await page.getByRole("button", { name: candidate?.name ?? "", exact: true }).click();
		await page.getByRole("button", { name: "Sett intervjutid", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Sett intervjutid" });
		await dialog.getByLabel("Tidspunkt").fill(`${day}T10:00`);
		await dialog.getByLabel("Rom", { exact: true }).fill("Java");
		await dialog.getByRole("checkbox", { name: "Kristin Berg" }).check();
		await dialog.getByRole("checkbox", { name: "Daniel Holm" }).check();
		await dialog.getByRole("checkbox", { name: /Søkeren har bekreftet/ }).check();
		await dialog.getByRole("button", { name: "Lagre intervjutid" }).click();
		await expect(dialog).toBeHidden();
		const saved = (await admissionsOverview())?.interviews.find(
			(row) => row.applicationId === candidate?._id,
		);
		expect(saved?.room).toBe("Java");
		expect(saved?.publishedAt).toBeUndefined();
		expect(saved?.interviewerIds).toHaveLength(2);
	});

	test("board cancellation updates the candidate and queues a cancellation notice", async ({
		page,
	}) => {
		await resetAdmissions("scheduled");
		const initial = await admissionsOverview();
		const interview = initial?.interviews[0];
		const candidate = initial?.candidates.find((row) => row._id === interview?.applicationId);
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: /^Kandidater/ }).click();
		await page.getByRole("button", { name: candidate?.name ?? "", exact: true }).click();
		await page.getByRole("button", { name: "Avlys intervju", exact: true }).click();
		const confirmation = page.getByRole("alertdialog", { name: "Avlyse intervjuet?" });
		await confirmation.getByRole("button", { name: "Bekreft avlysning" }).click();
		await expect(confirmation).toBeHidden();
		await expect.poll(async () => (await admissionsOverview())?.interviews.length).toBe(0);
		await expect
			.poll(async () =>
				(await admissionsOverview())?.localEmails.some((mail) => mail.subject.includes("avlyst")),
			)
			.toBe(true);
	});
});
