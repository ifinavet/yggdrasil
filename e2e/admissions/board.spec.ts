import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";

test.describe("Bifrost admissions preview", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/admissions");
		await expect(page.getByRole("heading", { name: "Opptak" })).toBeVisible();
	});

	test("configures interview rules and opens test calendar sources", async ({ page }) => {
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const settings = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await expect(settings).toBeVisible();
		await settings.getByLabel("Intervju (min)").fill("20");
		await settings.getByLabel("Buffer (min)").fill("10");
		await settings.getByLabel("Pause etter antall intervjuer").fill("2");
		await settings.getByLabel("Pause (min)").fill("20");
		await settings.getByLabel("Rom").fill("Gamma");
		await settings.getByText("Lunsj 12:00–12:30").click();
		await settings.getByText("Daniel Holm").click();
		await expect(settings.getByRole("checkbox", { name: "Lunsj 12:00–12:30" })).not.toBeChecked();
		await expect(settings.getByRole("checkbox", { name: "Daniel Holm" })).not.toBeChecked();
		await expect(settings.getByLabel("Intervju (min)")).toHaveValue("20");
		await expect(settings.getByLabel("Buffer (min)")).toHaveValue("10");
		await expect(settings.getByLabel("Pause etter antall intervjuer")).toHaveValue("2");
		await expect(settings.getByLabel("Pause (min)")).toHaveValue("20");
		await expect(settings.getByLabel("Rom")).toHaveValue("Gamma");
		await settings.getByRole("button", { name: "Lagre og finn tider" }).click();
		await expect(page.getByText("Nytt forslag er klart")).toBeVisible();
		await expect(page.getByRole("button", { name: "Godkjenn forslag" })).toBeEnabled();

		await page.getByRole("button", { name: "Kalendere" }).click();
		const calendars = page.getByRole("dialog", { name: "Kalendere" });
		await expect(calendars).toBeVisible();
		await expect(calendars.getByRole("link", { name: "Åpne Google Kalender" })).toBeVisible();
		await expect(calendars.getByText("Navet", { exact: true }).first()).toBeVisible();
		await calendars.getByText("Privat", { exact: true }).first().click();
		await expect(calendars.getByRole("checkbox", { name: "Privat" }).first()).toBeChecked();
		await calendars.getByRole("button", { name: "Ferdig" }).click();
		await expect(calendars).not.toBeVisible();
	});

	test("rebuilds and approves a schedule, and reviews candidates without a match", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Finn tider" }).click();
		await expect(page.getByText("Nytt forslag er klart")).toBeVisible();
		const approval = page.getByRole("button", { name: "Godkjenn forslag" });
		await expect(approval).toBeEnabled();
		await captureScreenshot(
			page,
			"board",
			"03-schedule-proposal.png",
			page.locator(".admissions-title"),
			{
				width: 1800,
				height: 1200,
			},
		);
		await approval.click();
		await expect(page.getByRole("button", { name: "Godkjent forslag" })).toBeDisabled();
		await page.getByRole("button", { name: "Neste uke" }).click();
		await expect(page.getByText("19.–23. oktober")).toBeVisible();
		await page.getByRole("button", { name: "Dag" }).click();
		await expect(page.locator(".admissions-day")).toHaveCount(1);
		await page.getByRole("button", { name: "Uke", exact: true }).click();
		await expect(page.locator(".admissions-day")).toHaveCount(5);
		await page.getByRole("button", { name: "Forrige uke" }).click();
		await expect(page.getByText(/trenger en tid/)).toBeVisible();
		await page.getByRole("button", { name: /Alma Nguyen/ }).click();
		const candidate = page.getByRole("dialog", { name: "Alma Nguyen" });
		await expect(candidate).toBeVisible();
		await expect(candidate.getByText("Kandidaten har ikke oppgitt tilgjengelighet.")).toBeVisible();
		await candidate.getByRole("button", { name: "Be om flere tider" }).click();
		await expect(page.getByText("Forhåndsvisning: forespørselen er ikke sendt.")).toBeVisible();
	});

	test("assigns an individual room and applies a room to every interview this week", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Godkjenn forslag" }).click();
		await expect(page.getByRole("button", { name: "Godkjent forslag" })).toBeDisabled();
		const firstInterview = page.locator(".admissions-interview").first();
		await expect(firstInterview).toBeVisible();
		const candidateName = (await firstInterview.locator("strong").innerText()).trim();
		await firstInterview.click();
		const candidate = page.getByRole("dialog", { name: candidateName });
		await expect(candidate).toBeVisible();
		await candidate.getByLabel("Rom").fill("Delta");
		await expect(candidate.getByRole("link", { name: /Delta/ })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(candidate).not.toBeVisible();
		await expect(page.getByRole("button", { name: "Godkjenn forslag" })).toBeEnabled();
		await page.getByRole("button", { name: "Sett rom" }).click();
		await page.getByRole("button", { name: "Velg alle i uken" }).click();
		const roomForm = page.locator("form.admissions-toolbar");
		const selectionCount = Number((await roomForm.innerText()).match(/(\d+) valgt/)?.[1] ?? 0);
		expect(selectionCount).toBeGreaterThan(0);
		const selectedCards = await page.locator(".admissions-interview").all();
		expect(selectedCards.length).toBeGreaterThan(0);
		await roomForm.getByLabel("Rom").fill("Epsilon");
		await roomForm.getByRole("button", { name: "Bruk på valgte" }).click();
		await expect(page.getByRole("button", { name: "Sett rom" })).toBeVisible();
		for (const card of selectedCards) await expect(card).toContainText("Epsilon");
	});

	test("searches and filters candidates, edits notes and decisions, and simulates sending", async ({
		page,
	}) => {
		await page.getByRole("button", { name: /Kandidater/ }).click();
		const search = page.getByPlaceholder("Søk etter kandidat");
		await page.keyboard.press("Control+k");
		await expect(search).toBeFocused();
		await page.keyboard.press("Control+k");
		await expect(search).not.toBeFocused();
		await search.fill("Anna Berg");
		await expect(page.getByRole("button", { name: "Anna Berg" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Sander Nguyen" })).toHaveCount(0);
		await search.clear();
		await page.getByRole("combobox", { name: "Studieprogram" }).click();
		await page
			.getByRole("option", { name: /Informatikk:/ })
			.first()
			.click();
		const visibleCandidateRows = page.locator(".admissions-table tbody tr");
		await expect(visibleCandidateRows.first()).toBeVisible();
		await expect(visibleCandidateRows).not.toHaveCount(36);
		await page.getByRole("combobox", { name: "Studieprogram" }).click();
		await page.getByRole("option", { name: "Alle linjer" }).click();
		await page.getByRole("combobox", { name: "Studieår" }).click();
		await page.getByRole("option", { name: "5. år" }).click();
		const fifthYearRows = await visibleCandidateRows.count();
		expect(fifthYearRows).toBeGreaterThan(0);
		expect(fifthYearRows).toBeLessThan(36);
		await search.fill("No such candidate");
		await expect(page.getByText("Ingen kandidater matcher filtrene.")).toBeVisible();
		await search.clear();
		await page.getByRole("combobox", { name: "Studieår" }).click();
		await page.getByRole("option", { name: "Alle år" }).click();
		await captureScreenshot(page, "board", "10-candidates.png", page.locator(".admissions-title"), {
			width: 1800,
			height: 1200,
		});
		await page.getByRole("button", { name: "Anna Berg" }).click();
		const candidate = page.getByRole("dialog", { name: "Anna Berg" });
		await candidate.getByLabel("Intervjunotater").fill("Testnotat for gjennomgang");
		await candidate.getByRole("combobox", { name: "Vedtak" }).click();
		await page.getByRole("option", { name: "Avslått" }).click();
		await expect(candidate.getByLabel("Intervjunotater")).toHaveValue("Testnotat for gjennomgang");
		await page.keyboard.press("Escape");
		await expect(candidate).not.toBeVisible();
		await page.getByRole("button", { name: "Anna Berg" }).click();
		const reopenedCandidate = page.getByRole("dialog", { name: "Anna Berg" });
		await expect(reopenedCandidate.getByLabel("Intervjunotater")).toHaveValue(
			"Testnotat for gjennomgang",
		);
		await expect(reopenedCandidate.getByRole("combobox", { name: "Vedtak" })).toContainText(
			"Avslått",
		);
		await page.keyboard.press("Escape");
		await expect(reopenedCandidate).not.toBeVisible();
		await page.getByRole("button", { name: "Send svar (3)" }).click();
		const sendDialog = page.getByRole("dialog", { name: "Send vedtak?" });
		await expect(sendDialog.getByText(/ingen e-post/)).toBeVisible();
		await expect(sendDialog).toContainText("2 tilbud og 1 avslag");
		await sendDialog.getByRole("button", { name: "Simuler utsending" }).click();
		await expect(page.getByRole("button", { name: "Send svar (0)" })).toBeDisabled();
		await expect(page.getByRole("row", { name: /Anna Berg/ })).toContainText("sendt");
		await captureScreenshot(
			page,
			"board",
			"17-decisions-sent.png",
			page.locator(".admissions-title"),
			{
				width: 1800,
				height: 1200,
			},
		);
	});

	test("advances and restores a selection round while preserving accepted candidates", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Utvelgelse" }).click();
		await expect(page.getByRole("region", { name: "Tatt opp" })).toContainText("Anna Berg");
		await captureScreenshot(
			page,
			"board",
			"13-selection-round-one.png",
			page.locator(".admissions-title"),
			{
				width: 1800,
				height: 1200,
			},
		);
		await page.getByRole("button", { name: "Neste runde" }).click();
		await expect(page.getByText("Runde 2")).toBeVisible();
		await expect(page.getByRole("region", { name: "Avslått" })).toContainText("Amir Ali");
		await expect(page.getByRole("region", { name: "Tatt opp" })).toContainText("Anna Berg");
		await expect(page.getByRole("region", { name: "Avslått" }).locator("article")).toHaveCount(28);
		await expect(page.getByRole("region", { name: "Tatt opp" }).locator("article")).toHaveCount(3);
		await captureScreenshot(
			page,
			"board",
			"14-selection-round-two.png",
			page.locator(".admissions-title"),
			{
				width: 1800,
				height: 1200,
			},
		);
		await page.getByRole("button", { name: "Forrige runde" }).click();
		await expect(page.getByText("Runde 1")).toBeVisible();
		await expect(page.getByRole("region", { name: "Videre" })).toContainText("Omar Hassan");
		await expect(page.getByRole("region", { name: "Videre" }).locator("article")).toHaveCount(5);
		await expect(page.getByRole("region", { name: "Avslått" }).locator("article")).toHaveCount(0);
		await captureScreenshot(
			page,
			"board",
			"15-previous-round-restored.png",
			page.locator(".admissions-title"),
			{
				width: 1800,
				height: 1200,
			},
		);
	});

	test("simulates deleting the preview and can start a fresh empty-free test round", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Innstillinger" }).click();
		await page
			.getByRole("dialog", { name: "Opptaksinnstillinger" })
			.getByRole("button", { name: "Avslutt og slett opptaket" })
			.click();
		const deleteDialog = page.getByRole("dialog", { name: "Slett opptaket?" });
		await expect(deleteDialog.getByText("Dette er testdata.")).toBeVisible();
		await deleteDialog.getByRole("button", { name: "Slett testdata" }).click();
		await expect(page.getByRole("heading", { name: "Ingen aktive opptak" })).toBeVisible();
		await page.getByRole("button", { name: "Start opptak med testdata" }).click();
		await page.getByRole("button", { name: /Kandidater/ }).click();
		await expect(page.getByRole("row")).toHaveCount(37);
	});
});
