import { expect, test } from "@playwright/test";
import { captureEmail, captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
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
		await expect(page.getByText("Venter på svar", { exact: true })).toHaveCount(1);
		const offerEmail = (await admissionsOverview())?.localEmails[0];
		if (offerEmail) await captureEmail(page, "student", "live-offer-email.png", offerEmail.html);
		await captureScreenshot(
			page,
			"board",
			"live-05-candidate-decisions.png",
			page.getByRole("heading", { name: "Opptak", exact: true }),
		);
	});
	test("schedules and publishes at least ten interviews without overlapping the same interviewers", async ({
		page,
	}) => {
		await resetAdmissions("open");
		await page.reload();
		await page.getByRole("button", { name: "Finn tider", exact: true }).click();
		await expect(page.getByText("Nytt forslag er klart", { exact: true })).toBeVisible();
		const overview = await admissionsOverview();
		expect(overview).not.toBeNull();
		const interviews = overview?.interviews ?? [];
		expect(interviews.length).toBeGreaterThanOrEqual(10);
		for (const interview of interviews) {
			expect(new Set(interview.interviewerIds).size).toBe(2);
			expect(interview.endAt - interview.startAt).toBe(15 * 60_000);
			expect(interview.room).toBe("Beta");
			for (const other of interviews.filter((row) => row._id !== interview._id)) {
				if (other.interviewerIds.some((id) => interview.interviewerIds.includes(id))) {
					expect(
						other.endAt + 5 * 60_000 <= interview.startAt ||
							interview.endAt + 5 * 60_000 <= other.startAt,
					).toBe(true);
				}
			}
		}
		await captureScreenshot(
			page,
			"board",
			"live-06-generated-schedule.png",
			page.getByRole("heading", { name: "Opptak", exact: true }),
		);
		await page.getByRole("button", { name: "Godkjenn forslag", exact: true }).click();
		await expect(
			page.getByText("Intervjuplanen er klar for utsending", { exact: true }),
		).toBeVisible();
		await expect
			.poll(
				async () =>
					(await admissionsOverview())?.interviews.filter((row) => row.publishedAt).length,
			)
			.toBe(interviews.length);
		await expect
			.poll(async () => (await admissionsOverview())?.localEmails.length)
			.toBe(interviews.length);
		const invitation = (await admissionsOverview())?.localEmails[0];
		if (invitation)
			await captureEmail(page, "student", "live-invitation-email.png", invitation.html);
	});
});
