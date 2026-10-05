import { expect, type Page, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	clearCookieNotice,
	huginUrl,
	midgardUrl,
	resetAdmissions,
} from "./production-helpers";

async function apply(page: Page) {
	await captureScreenshot(page, "student", "live-02-profile-confirm.png", page.getByRole("main"));
	await page.getByRole("button", { name: "Ja" }).click();
	await page.getByRole("button", { name: "Endre" }).click();
	await captureScreenshot(page, "student", "live-03-profile-edit.png", page.getByRole("main"));
	await page.getByRole("combobox", { name: "Studieprogram" }).click();
	await page.getByRole("option", { name: "Informasjonssikkerhet", exact: true }).click();
	await expect(page.getByRole("combobox", { name: "Grad", exact: true })).toContainText("Master");
	await expect(page.getByRole("combobox", { name: "Studieår" })).toContainText("4");
	await page.getByRole("combobox", { name: "Studieprogram" }).click();
	await page
		.getByRole("option", { name: "Informatikk: programmering og systemarkitektur", exact: true })
		.click();
	await page.getByRole("combobox", { name: "Grad", exact: true }).click();
	await page.getByRole("option", { name: "Bachelor", exact: true }).click();
	await expect(page.getByRole("combobox", { name: "Studieår" })).toContainText("3");
	await page.getByRole("combobox", { name: "Studieår" }).click();
	await page.getByRole("option", { name: "2" }).click();
	await page.getByRole("button", { name: "Lagre og bekreft" }).click();
	await page
		.getByLabel("Fortell litt om deg selv")
		.fill("Jeg liker å lage ting sammen med andre studenter.");
	await page
		.getByLabel("Hvorfor vil du bli med i Navet?")
		.fill("Jeg vil lære mer og bidra til et godt studentmiljø.");
	await page.getByRole("combobox", { name: "Hvilken arbeidsgruppe vil du være med i?" }).click();
	await page.getByRole("option", { name: "Usikker ennå" }).click();
	await page.keyboard.press("Escape");
	await clearCookieNotice(page);
	await expect(page.getByRole("option", { name: "Usikker ennå" })).toHaveCount(0);
	await captureScreenshot(
		page,
		"student",
		"live-04-filled-answers.png",
		page.getByLabel("Fortell litt om deg selv"),
	);
	const existingAvailability = page.getByRole("button", { name: /^Fjern/ });
	await expect(existingAvailability).toHaveCount(1);
	while (await existingAvailability.count()) {
		const remaining = await existingAvailability.count();
		await existingAvailability.first().click();
		await expect(existingAvailability).toHaveCount(remaining - 1);
	}
	await page.getByRole("checkbox", { name: /Velg/ }).nth(0).check();
	await page.getByRole("checkbox", { name: /Velg/ }).nth(1).check();
	await page.getByLabel("Fra", { exact: true }).fill("09:07");
	await expect(
		page.getByRole("button", { name: "Legg til tidsrom på valgte dager" }),
	).toBeDisabled();
	await page.getByLabel("Fra", { exact: true }).fill("09:00");
	await page.getByRole("button", { name: "Legg til tidsrom på valgte dager" }).click();
	await expect(page.getByText("2 tidsrom valgt")).toBeVisible();
	await captureScreenshot(
		page,
		"student",
		"live-05-availability.png",
		page.getByRole("heading", { name: "Når kan du komme på intervju?" }),
	);
	await expect(page.getByText(/Søknadsopplysningene slettes/)).toBeVisible();
	await expect(page.getByText(/Studentprofilen din på Midgard blir ikke slettet/)).toBeVisible();
	await captureScreenshot(
		page,
		"student",
		"live-06-consent.png",
		page.getByText(/Søknadsopplysningene slettes/),
	);
	await page.getByRole("checkbox", { name: /godtar/i }).check();
	await page.getByRole("button", { name: "Send søknad" }).click();
}

test.describe("real applicant journeys", () => {
	test.describe.configure({ mode: "serial" });

	test("submits a persistent application, updates the student profile, and hides the Midgard banner", async ({
		page,
	}) => {
		await resetAdmissions("open");
		await page.goto(midgardUrl);
		await clearCookieNotice(page);
		await expect(page.getByRole("link", { name: "Søk her" })).toBeVisible();
		await captureScreenshot(
			page,
			"student",
			"live-01-midgard-banner.png",
			page.getByRole("link", { name: "Søk her" }),
		);
		await page.getByRole("link", { name: "Søk her" }).click();
		await expect(page).toHaveURL(/\/admissions$/);
		const huginCookieNotice = page.getByRole("button", { name: "Avslå bruk av cookies" });
		await expect(huginCookieNotice).toBeVisible();
		await huginCookieNotice.click();
		await expect(huginCookieNotice).toBeHidden();
		await expect(page.getByRole("heading", { name: "Bli med i Navet" })).toBeVisible();

		await apply(page);
		await expect(page.getByRole("heading", { name: "Søknaden din er sendt" })).toBeVisible();
		await captureScreenshot(
			page,
			"student",
			"live-07-submission-receipt.png",
			page.getByRole("heading", { name: "Søknaden din er sendt" }),
		);
		await expect(page.getByText("Forhåndsvisning", { exact: false })).toHaveCount(0);
		await page.reload();
		await expect(page.getByRole("heading", { name: "Søknaden din er sendt" })).toBeVisible();
		await page.getByRole("button", { name: "Rediger søknaden" }).click();
		await expect(page.getByLabel("Fortell litt om deg selv")).toHaveValue(
			"Jeg liker å lage ting sammen med andre studenter.",
		);
		await page
			.getByLabel("Hvorfor vil du bli med i Navet?")
			.fill("Jeg vil bidra og lære gjennom gode prosjekter.");
		await page.getByRole("button", { name: "Ja" }).click();
		await page.getByRole("checkbox", { name: /godtar/i }).check();
		await page.getByRole("button", { name: "Send søknad" }).click();
		await expect(page.getByRole("heading", { name: "Søknaden din er sendt" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Søk her" })).toHaveCount(0);

		await page.goto(`${midgardUrl}/profile`);
		await expect(page.getByRole("combobox", { name: "Studieår" })).toContainText("2");
	});

	test("removes the Midgard application banner when the application window closes in an open tab", async ({
		page,
	}) => {
		await resetAdmissions("open");
		const overview = await admissionsOverview();
		const deadline = overview?.period.applicationEndAt;
		expect(deadline).toBeDefined();
		await page.clock.install();
		await page.goto(midgardUrl);
		await clearCookieNotice(page);
		await expect(page.getByRole("link", { name: "Søk her" })).toBeVisible();
		await page.clock.fastForward((deadline ?? Date.now()) - Date.now() + 1000);
		await expect(page.getByRole("link", { name: "Søk her" })).toHaveCount(0);
	});

	test("closes the Hugin application form when the application window closes in an open tab", async ({
		page,
	}) => {
		await resetAdmissions("open");
		const overview = await admissionsOverview();
		const deadline = overview?.period.applicationEndAt;
		expect(deadline).toBeDefined();
		await page.clock.install();
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(page.getByRole("heading", { name: "Bli med i Navet" })).toBeVisible();
		await page.clock.fastForward((deadline ?? Date.now()) - Date.now() + 1000);
		await expect(page.getByRole("heading", { name: "Søknadsperioden er avsluttet" })).toBeVisible();
		await expect(page.getByLabel("Fortell litt om deg selv")).toHaveCount(0);
	});

	test("shows an assigned interview and always lets the applicant cancel it", async ({ page }) => {
		await resetAdmissions("scheduled");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(page.getByRole("heading", { name: "Intervjuet ditt" })).toBeVisible();
		await expect(page.getByText("Møterom", { exact: false })).toBeVisible();
		await expect(page.getByRole("link", { name: "Beta" })).toHaveAttribute(
			"href",
			"https://ifirom.no/beta",
		);
		await captureScreenshot(
			page,
			"student",
			"live-08-interview.png",
			page.getByRole("heading", { name: "Intervjuet ditt" }),
		);
		const cancel = page.getByRole("button", { name: "Avlys intervjuet" });
		await expect(cancel).toBeVisible();
		await cancel.click();
		await page.getByRole("button", { name: "Ja, avlys intervjuet" }).click();
		await expect(page.getByText("Intervjuet er avlyst")).toBeVisible();
		await page.reload();
		await expect(page.getByRole("heading", { name: "Intervjuet er avlyst" })).toBeVisible();
		await captureScreenshot(
			page,
			"student",
			"live-09-interview-cancelled.png",
			page.getByText("Intervjuet er avlyst"),
		);
	});

	test("allows the applicant to submit when none of the suggested interview times work", async ({
		page,
	}) => {
		await resetAdmissions("open");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: "Ja" }).click();
		await page
			.getByLabel("Fortell litt om deg selv")
			.fill("Jeg liker å løse problemer sammen med andre.");
		await page
			.getByLabel("Hvorfor vil du bli med i Navet?")
			.fill("Jeg vil bidra og lære gjennom gode prosjekter.");
		await page.getByRole("combobox", { name: "Hvilken arbeidsgruppe vil du være med i?" }).click();
		await page.getByRole("option", { name: "Usikker ennå" }).click();
		const noSuitableTimes = page.getByRole("checkbox", { name: "Ingen av tidene passer" });
		await noSuitableTimes.check();
		await expect(noSuitableTimes).toBeChecked();
		await page.getByRole("checkbox", { name: /godtar/i }).check();
		await page.getByRole("button", { name: "Send søknad" }).click();
		await expect(page.getByRole("heading", { name: "Søknaden din er sendt" })).toBeVisible();
	});

	test("lets the applicant accept an offer and does not start onboarding before acceptance", async ({
		page,
	}) => {
		await resetAdmissions("decisions");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(page.getByRole("heading", { name: "Du har fått tilbud om plass" })).toBeVisible();
		await expect(page.getByRole("link", { name: /bli medlem|IAM/i })).toHaveCount(0);
		await captureScreenshot(
			page,
			"student",
			"live-10-offer-pending.png",
			page.getByRole("heading", { name: "Du har fått tilbud om plass" }),
		);
		await page.getByRole("button", { name: "Takk ja" }).click();
		await expect(page.getByRole("alertdialog", { name: "Takke ja til plassen?" })).toBeVisible();
		await page.getByRole("button", { name: "Bekreft at jeg takker ja" }).click();
		await expect(page.getByText("Du har takket ja til plassen")).toBeVisible();
		await captureScreenshot(
			page,
			"student",
			"live-11-offer-accepted.png",
			page.getByText("Du har takket ja til plassen"),
		);
	});

	test("lets the applicant decline an offer without exposing board notes or reapplication language", async ({
		page,
	}) => {
		await resetAdmissions("decisions");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: "Takk nei" }).click();
		await expect(page.getByRole("alertdialog", { name: "Takke nei til plassen?" })).toBeVisible();
		await page.getByRole("button", { name: "Bekreft at jeg takker nei" }).click();
		await expect(page.getByText("Takk for at du ga beskjed")).toBeVisible();
		await expect(page.getByText(/notat|styrets vurdering|søk på nytt/i)).toHaveCount(0);
		await captureScreenshot(
			page,
			"student",
			"live-12-offer-declined.png",
			page.getByText("Takk for at du ga beskjed"),
		);
	});

	test("shows an expired offer after the applicant tries to accept it after the deadline", async ({
		page,
	}) => {
		await resetAdmissions("offer-expired");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(page.getByRole("heading", { name: "Du har fått tilbud om plass" })).toBeVisible();
		await page.getByRole("button", { name: "Takk ja" }).click();
		await page.getByRole("button", { name: "Bekreft at jeg takker ja" }).click();
		await expect(page.getByRole("heading", { name: "Svarfristen er passert" })).toBeVisible();
		await expect(page.getByText("Du har takket ja til plassen")).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Takk ja" })).toHaveCount(0);
		await clearCookieNotice(page);
		await expect(page.getByRole("button", { name: "Avslå bruk av cookies" })).toBeHidden();
		await captureScreenshot(
			page,
			"student",
			"live-15-offer-expired.png",
			page.getByRole("heading", { name: "Svarfristen er passert" }),
		);
	});

	test("shows the closed state after the application window ends", async ({ page }) => {
		await resetAdmissions("empty");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(page.getByRole("heading", { name: "Søknadsperioden er avsluttet" })).toBeVisible();
		await captureScreenshot(
			page,
			"student",
			"live-13-closed.png",
			page.getByRole("heading", { name: "Søknadsperioden er avsluttet" }),
		);
	});

	test("offers profile recovery when the applicant has no student record", async ({ page }) => {
		await resetAdmissions("missing-profile");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(
			page.getByRole("heading", { name: "Studentprofilen din er ikke klar ennå" }),
		).toBeVisible();
		await expect(page.getByRole("link", { name: "Åpne profilen" })).toHaveAttribute(
			"href",
			/\/profile$/,
		);
		await captureScreenshot(
			page,
			"student",
			"live-14-missing-profile.png",
			page.getByRole("heading", { name: "Studentprofilen din er ikke klar ennå" }),
		);
	});
});
