import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	failGoogle,
	huginUrl,
	resetAdmissions,
} from "./production-helpers";

test.describe("persistent board admissions", () => {
	test.describe.configure({ mode: "serial" });
	test.beforeEach(async ({ page }) => {
		await resetAdmissions("scheduled");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
	});

	test("bulk room changes survive reload", async ({ page }) => {
		await captureScreenshot(
			page,
			"board",
			"live-01-calendar.png",
			page.getByRole("heading", { name: "Opptak", exact: true }),
		);
		await page.getByRole("button", { name: "Sett rom", exact: true }).click();
		await page.getByRole("button", { name: "Velg alle i uken" }).click();
		await page.getByLabel("Rom", { exact: true }).fill("Java");
		await captureScreenshot(
			page,
			"board",
			"live-02-bulk-room.png",
			page.getByRole("heading", { name: "Opptak", exact: true }),
		);
		await page.getByRole("button", { name: "Bruk på valgte" }).click();
		await expect(page.getByText("Romfordelingen er lagret", { exact: true })).toBeVisible();
		await page.reload();
		await expect(page.getByText("Java", { exact: true }).first()).toBeVisible();
	});

	test("notes are saved explicitly and remain after reload", async ({ page }) => {
		await page.getByRole("button", { name: /^Kandidater/ }).click();
		await page.getByRole("table").getByRole("button").first().click();
		const dialog = page.getByRole("dialog");
		const name = await dialog.getByRole("heading").first().textContent();
		await dialog.getByLabel("Intervjunotater").fill("Godt samarbeidseksempel fra prosjektarbeid.");
		await captureScreenshot(page, "board", "live-03-candidate-notes.png", dialog);
		await dialog.getByRole("button", { name: "Lagre notater" }).click();
		await expect(page.getByText("Notatene er lagret", { exact: true })).toBeVisible();
		await page.reload();
		await page.getByRole("button", { name: /^Kandidater/ }).click();
		await page.getByRole("button", { name: name ?? "", exact: true }).click();
		await expect(page.getByLabel("Intervjunotater")).toHaveValue(
			"Godt samarbeidseksempel fra prosjektarbeid.",
		);
	});

	test("a declined offer can be replaced without resending other decisions", async ({ page }) => {
		await resetAdmissions("decisions");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: "Takk nei", exact: true }).click();
		await page.getByRole("button", { name: "Bekreft at jeg takker nei" }).click();
		await expect(page.getByText("Takk for at du ga beskjed", { exact: true })).toBeVisible();
		await page.goto(`${bifrostUrl}/admissions`);
		await page.getByRole("button", { name: /^Kandidater/ }).click();
		await expect(page.getByText("Takket nei", { exact: true })).toBeVisible();
		const replacement = page.getByRole("row").filter({ hasText: "Avslått" }).first();
		await replacement.getByRole("button").click();
		await page.getByRole("combobox", { name: "Vedtak" }).click();
		await page.getByRole("option", { name: "Tatt opp", exact: true }).click();
		const offer = page.getByRole("dialog", { name: /^Tilbud til/ });
		await offer.getByRole("combobox", { name: "Arbeidsgruppe" }).click();
		await page.getByRole("option", { name: "Web", exact: true }).click();
		await offer.getByLabel("Navet-adresse").fill("replacement@ifinavet.no");
		await captureScreenshot(page, "board", "live-04-replacement-offer.png", offer);
		await offer.getByRole("button", { name: "Lagre tilbud" }).click();
		await expect(offer).not.toBeVisible();
		await page.getByRole("button", { name: "Send tilbud", exact: true }).click();
		await expect(
			page.getByText("Tilbudet er lagt i kø for utsending", { exact: true }),
		).toBeVisible();
		await page.keyboard.press("Escape");
		await expect
			.poll(
				async () =>
					(await admissionsOverview())?.jobs.filter((job) => job.kind === "send_decision").length,
			)
			.toBe(1);
		const queued = (await admissionsOverview())?.candidates.filter(
			(candidate) => candidate.decisionQueuedAt !== undefined,
		);
		expect(queued).toHaveLength(1);
		expect(queued?.[0]?.decisionSentAt).toBeUndefined();
		expect(queued?.[0]).toMatchObject({
			reviewedWorkspaceEmail: "replacement@ifinavet.no",
		});
		await captureScreenshot(
			page,
			"board",
			"live-05-candidate-decisions.png",
			page.getByRole("heading", { name: "Opptak", exact: true }),
		);
	});
	test("reports scheduling provider failure without inventing interview times", async ({
		page,
	}) => {
		await resetAdmissions("open");
		await failGoogle(true);
		await page.reload();
		await page.getByRole("button", { name: "Finn tider", exact: true }).click();
		await expect(
			page.getByRole("alert").filter({
				hasText: "Google Calendar svarte 503 da vi skulle lese opptattstatus.",
			}),
		).toBeVisible();
		await captureScreenshot(
			page,
			"board",
			"live-23-scheduling-error.png",
			page.getByRole("main").last(),
		);
		expect((await admissionsOverview())?.interviews).toHaveLength(0);
		await page.reload();
		expect((await admissionsOverview())?.interviews).toHaveLength(0);
	});
	test("publishes a seeded ten-interview proposal by persisting provider jobs", async ({
		page,
	}) => {
		await resetAdmissions("planned");
		await page.reload();
		const interviews = (await admissionsOverview())?.interviews ?? [];
		expect(interviews).toHaveLength(10);
		for (const interview of interviews) {
			expect(new Set(interview.interviewerIds).size).toBe(2);
			expect(interview.endAt - interview.startAt).toBe(15 * 60_000);
			expect(interview.room).toBe("Beta");
			expect(interview.publishedAt).toBeUndefined();
			for (const other of interviews.filter((row) => row._id !== interview._id)) {
				if (other.interviewerIds.some((id) => interview.interviewerIds.includes(id)))
					expect(
						other.endAt + 5 * 60_000 <= interview.startAt ||
							interview.endAt + 5 * 60_000 <= other.startAt,
					).toBe(true);
			}
		}
		await captureScreenshot(
			page,
			"board",
			"live-06-seeded-schedule.png",
			page.getByRole("heading", { name: "Opptak", exact: true }),
		);
		await page.getByRole("button", { name: "Godkjenn forslag", exact: true }).click();
		await expect(
			page.getByText("Intervjuplanen er klar for utsending", { exact: true }),
		).toBeVisible();
		await expect
			.poll(
				async () =>
					(await admissionsOverview())?.interviews.filter(
						(interview) => interview.publishedAt !== undefined,
					).length,
				{ timeout: 60_000 },
			)
			.toBe(10);
		await captureScreenshot(
			page,
			"board",
			"live-24-publication-queued.png",
			page.getByRole("main").last(),
		);
		await page.reload();
		expect((await admissionsOverview())?.jobs.filter((job) => job.kind === "publish")).toHaveLength(
			0,
		);
	});
});
