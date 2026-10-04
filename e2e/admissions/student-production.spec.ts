import { expect, type Page, test } from "@playwright/test";
import { clearCookieNotice, huginUrl, midgardUrl, resetAdmissions } from "./production-helpers";

async function apply(page: Page) {
	await page.getByRole("button", { name: "Ja" }).click();
	await page.getByRole("button", { name: "Endre" }).click();
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
	const existingAvailability = page.getByRole("button", { name: /^Fjern/ });
	while ((await existingAvailability.count()) > 0) await existingAvailability.first().click();
	await page.getByRole("checkbox", { name: /Velg/ }).nth(0).check();
	await page.getByRole("checkbox", { name: /Velg/ }).nth(1).check();
	await page.getByRole("button", { name: "Legg til tidsrom på valgte dager" }).click();
	await expect(page.getByText("3 tidsrom valgt")).toBeVisible();
	await expect(page.getByText(/Søknadsopplysningene slettes/)).toBeVisible();
	await expect(page.getByText(/Studentprofilen din på Midgard blir ikke slettet/)).toBeVisible();
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
		await page.getByRole("link", { name: "Søk her" }).click();
		await expect(page).toHaveURL(/\/admissions$/);
		await expect(page.getByRole("heading", { name: "Bli med i Navet" })).toBeVisible();

		await apply(page);
		await expect(page.getByRole("heading", { name: "Søknaden din er sendt" })).toBeVisible();
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
		await expect(page.getByRole("spinbutton", { name: "År" })).toHaveValue("2");
	});

	test("shows an assigned interview and always lets the applicant cancel it", async ({ page }) => {
		await resetAdmissions("scheduled");
		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await expect(page.getByRole("heading", { name: "Intervjuet ditt" })).toBeVisible();
		await expect(page.getByText("Møterom", { exact: false })).toBeVisible();
		const cancel = page.getByRole("button", { name: "Avlys intervjuet" });
		await expect(cancel).toBeVisible();
		await cancel.click();
		await page.getByRole("button", { name: "Ja, avlys intervjuet" }).click();
		await expect(page.getByText("Intervjuet er avlyst")).toBeVisible();
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
		await page.getByRole("button", { name: "Takk ja" }).click();
		await expect(page.getByRole("alertdialog", { name: "Takke ja til plassen?" })).toBeVisible();
		await page.getByRole("button", { name: "Bekreft at jeg takker ja" }).click();
		await expect(page.getByText("Du har takket ja til plassen")).toBeVisible();
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
	});
});
