import { expect, test } from "@playwright/test";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import { captureScreenshot } from "./capture-screenshot";
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
		await dialog.getByRole("combobox", { name: "To intervjuere", exact: true }).click();
		await page.getByRole("option", { name: "Kristin Berg", exact: true }).click();
		await page.getByRole("option", { name: "Daniel Holm", exact: true }).click();
		await page.keyboard.press("Escape");
		await dialog.getByRole("checkbox", { name: /Søkeren har bekreftet/ }).check();
		await captureScreenshot(page, "board", "live-09-manual-interview.png", dialog);
		await dialog.getByRole("button", { name: "Lagre intervjutid" }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByLabel("Rom", { exact: true })).toHaveValue("Java");
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
		await captureScreenshot(page, "board", "live-10-cancel-interview.png", confirmation);
		await confirmation.getByRole("button", { name: "Bekreft avlysning" }).click();
		await expect(confirmation).toBeHidden();
		await expect.poll(async () => (await admissionsOverview())?.interviews.length).toBe(0);
		await expect
			.poll(async () =>
				(await admissionsOverview())?.jobs.filter((job) => job.kind === "cancel_interview"),
			)
			.toMatchObject([{ interviewId: interview?._id, notifyApplicant: true, state: "inProgress" }]);
		await page.reload();
		expect((await admissionsOverview())?.interviews).toHaveLength(0);
		expect(
			(await admissionsOverview())?.jobs.filter((job) => job.kind === "cancel_interview"),
		).toHaveLength(1);
	});

	test("moving a published interview republishes it with a new time", async ({ page }) => {
		await resetAdmissions("scheduled");
		const initial = await admissionsOverview();
		const interview = initial?.interviews[0];
		const candidate = initial?.candidates.find((row) => row._id === interview?.applicationId);
		const day = formatOsloDate(interview?.startAt ?? 0, "yyyy-MM-dd");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: /^Kandidater/ }).click();
		await page.getByRole("button", { name: candidate?.name ?? "", exact: true }).click();
		await page.getByRole("button", { name: "Flytt intervju", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Flytt intervju" });
		await expect(dialog.getByLabel("Tidspunkt")).toHaveValue(`${day}T10:00`);
		await expect(dialog.getByLabel("Rom", { exact: true })).toHaveValue("Beta");
		await dialog.getByLabel("Tidspunkt").fill(`${day}T10:20`);
		await captureScreenshot(page, "board", "live-11-move-interview.png", dialog);
		await dialog.getByRole("button", { name: "Flytt intervju" }).click();
		await expect(dialog).toBeHidden();
		await expect
			.poll(async () => (await admissionsOverview())?.interviews[0]?.startAt)
			.toBe(osloDateTimeToEpoch(day, "10:20"));
		await expect
			.poll(async () =>
				(await admissionsOverview())?.jobs.filter(
					(job) => job.kind === "publish" && job.interviewId === interview?._id,
				),
			)
			.toMatchObject([{ rescheduled: true }]);
	});

	test("suggested times report a provider failure without saving anything", async ({ page }) => {
		await resetAdmissions("open");
		const initial = await admissionsOverview();
		const candidate = initial?.candidates.find((row) => row.availability.length > 0);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: /^Kandidater/ }).click();
		await page.getByRole("button", { name: candidate?.name ?? "", exact: true }).click();
		await page.getByRole("button", { name: "Foreslå tider", exact: true }).click();
		await expect(page.getByText("Kunne ikke hente ledige tider.")).toBeVisible();
		await captureScreenshot(
			page,
			"board",
			"live-35-suggestion-failure-mobile.png",
			page.getByText("Kunne ikke hente ledige tider."),
		);
		expect((await admissionsOverview())?.interviews).toHaveLength(0);
	});
});
