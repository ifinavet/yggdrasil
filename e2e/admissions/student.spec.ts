import { expect, type Page, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";

async function clearNotices(page: Page) {
	const cookieNotice = page.getByRole("button", { name: "Avslå bruk av cookies" });
	await cookieNotice.waitFor({ state: "visible" });
	await cookieNotice.click();
	const issueBadge = page.getByRole("button", { name: "Collapse issues badge" });
	if (await issueBadge.isVisible().catch(() => false)) await issueBadge.click();
}

test("student can complete the local application preview", async ({ page }) => {
	await page.goto("/admissions?preview=open");
	await clearNotices(page);
	await captureScreenshot(
		page,
		"student",
		"01-application.png",
		page.getByRole("heading", { name: "Bli med i Navet" }),
	);
	await expect(page.getByText("Lokalt førsteutkast med testdata")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Bli med i Navet" })).toBeVisible();
	await expect(page.getByText(/hvor gammel|hvor du kommer fra/i)).toHaveCount(0);

	const about = page.getByLabel("Fortell litt om deg selv");
	const motivation = page.getByLabel("Hvorfor vil du bli med i Navet?");
	await expect
		.poll(() => about.evaluate((el: HTMLTextAreaElement) => el.validity.valueMissing))
		.toBe(true);
	await about.fill("Kort svar");
	await expect
		.poll(() => about.evaluate((el: HTMLTextAreaElement) => el.validity.tooShort))
		.toBe(true);
	await about.fill("Jeg liker å lage ting sammen med andre studenter.");
	await motivation.fill("Jeg vil lære mer og bidra til et godt studentmiljø.");

	const submit = page.getByRole("button", { name: "Send søknad" });
	await expect(submit).toBeDisabled();
	await page.getByRole("button", { name: "Ja" }).click();
	await expect(page.getByText("Bekreftet")).toBeVisible();
	await page.getByRole("button", { name: "Endre" }).click();
	await expect(submit).toBeDisabled();
	await captureScreenshot(
		page,
		"student",
		"02-edit-profile.png",
		page.getByRole("region", { name: "Studieopplysninger" }),
	);
	await page.getByRole("combobox", { name: "Studieår" }).click();
	await page.getByRole("option", { name: "2" }).click();
	await page.getByRole("button", { name: "Lagre og bekreft" }).click();
	await expect(page.getByText("2. år")).toBeVisible();
	await page.getByRole("combobox", { name: "Hvilken arbeidsgruppe vil du være med i?" }).click();
	await page.getByRole("option", { name: "Usikker ennå" }).click();

	const firstWeekSlot = page.getByRole("button", { name: /klokken 09:00/ }).first();
	await firstWeekSlot.click();
	await expect(firstWeekSlot).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Neste uke" }).click();
	await expect(page.getByText("19.–23. oktober")).toBeVisible();
	const secondWeekSlot = page.getByRole("button", { name: /klokken 09:00/ }).first();
	await secondWeekSlot.click();
	await captureScreenshot(
		page,
		"student",
		"04-availability-second-week.png",
		page.getByRole("heading", { name: "Når kan du komme på intervju?" }),
	);
	await page.getByRole("button", { name: "Forrige uke" }).click();
	await expect(page.getByText("12.–16. oktober")).toBeVisible();
	await expect(page.getByRole("button", { name: /klokken 09:00/ }).first()).toHaveAttribute(
		"aria-pressed",
		"true",
	);

	const consent = page.getByRole("checkbox", { name: "Jeg godkjenner" });
	await expect(submit).toBeDisabled();
	await consent.check();
	await expect(submit).toBeEnabled();
	await page.getByRole("button", { name: "Endre" }).click();
	await expect(submit).toBeDisabled();
	await page.getByRole("button", { name: "Lagre og bekreft" }).click();
	await expect(submit).toBeEnabled();

	await page
		.getByRole("button", { name: /klokken 09:00/ })
		.first()
		.click();
	await expect(submit).toBeEnabled();
	await page.getByRole("button", { name: "Neste uke" }).click();
	await page
		.getByRole("button", { name: /klokken 09:00/ })
		.first()
		.click();
	await expect(submit).toBeDisabled();
	await page
		.getByRole("button", { name: /klokken 09:00/ })
		.first()
		.click();
	await expect(submit).toBeEnabled();
	await consent.uncheck();
	await expect(submit).toBeDisabled();
	await consent.check();
	await expect(submit).toBeEnabled();
	await captureScreenshot(page, "student", "03-answers.png", about);
	await captureScreenshot(page, "student", "05-consent-submit.png", consent);
	await submit.click();

	await expect(page.getByRole("heading", { name: "Takk for søknaden!" })).toBeVisible();
	await captureScreenshot(
		page,
		"student",
		"06-confirmation.png",
		page.getByRole("heading", { name: "Takk for søknaden!" }),
	);
	await expect(
		page.getByText("Forhåndsvisning: ingen søknad eller e-post er sendt."),
	).toBeVisible();
	await page.getByRole("button", { name: "Se søknaden" }).click();
	await expect(page.getByRole("button", { name: "Send søknad" })).toBeVisible();
	await page.reload();
	await expect(page.getByLabel("Fortell litt om deg selv")).toHaveValue("");
	await expect(page.getByText("1. år")).toBeVisible();
});

test("missing work group blocks browser form submission", async ({ page }) => {
	await page.goto("/admissions?preview=open");
	await clearNotices(page);
	await page.getByRole("button", { name: "Ja" }).click();
	await page.getByLabel("Fortell litt om deg selv").fill("Jeg liker å møte nye mennesker.");
	await page
		.getByLabel("Hvorfor vil du bli med i Navet?")
		.fill("Jeg vil lære mer og bidra til miljøet.");
	await page
		.getByRole("button", { name: /klokken 09:00/ })
		.first()
		.click();
	await page.getByRole("checkbox", { name: "Jeg godkjenner" }).check();
	const submit = page.getByRole("button", { name: "Send søknad" });
	await expect(submit).toBeEnabled();
	await submit.click();
	await expect(page.getByRole("heading", { name: "Bli med i Navet" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Takk for søknaden!" })).toHaveCount(0);
});

test("closed preview shows the closed application period", async ({ page }) => {
	await page.goto("/admissions?preview=closed");
	await clearNotices(page);
	await captureScreenshot(
		page,
		"student",
		"07-closed.png",
		page.getByRole("heading", { name: "Søknadsperioden er avsluttet" }),
	);
	await expect(page.getByRole("heading", { name: "Søknadsperioden er avsluttet" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Bli med i Navet" })).toHaveCount(0);
});
