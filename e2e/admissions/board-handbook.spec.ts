import { expect, test } from "@playwright/test";

const suffix = Date.now().toString(36);
const title = `Håndboktest ${suffix}`;
const slug = `handboktest-${suffix}`;
const alias = `finnrutinen${suffix}`;

test.describe("Bifrost handbook", () => {
	test("searches verified routines and remains usable on mobile in both themes", async ({
		page,
	}) => {
		await page.goto("/wiki");
		await expect(page.getByRole("heading", { name: "Hva skal du gjøre?" })).toBeVisible();
		const initialize = page.getByRole("button", { name: "Klargjør håndboken" });
		if (await initialize.isVisible()) await initialize.click();
		await page.getByRole("searchbox", { name: "Søk i håndboken" }).fill("prikksystem");
		await page.getByRole("link", { name: /Registrere oppmøte og rette prikker/ }).click();
		await expect(
			page.getByRole("heading", { name: "Registrere oppmøte og rette prikker", exact: true }),
		).toBeVisible();
		await expect(page.getByText("180 dager. Utløpte prikker ryddes periodisk.")).toBeVisible();
		await page.goto("/wiki");
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole("searchbox")).toBeInViewport();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
		await page.getByRole("button", { name: "Velg fargetema" }).click();
		await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
		await expect(page.locator("html")).toHaveClass(/dark/);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
		await page.screenshot({ path: "test-results/handbook-mobile-dark.png", fullPage: true });
	});

	test("publishes, bookmarks, reports and retires an article with history", async ({ page }) => {
		await page.goto("/wiki/new");
		await page.getByLabel("Tittel", { exact: true }).fill(title);
		await page.getByLabel("Adresse etter /wiki/").fill(slug);
		await page.getByLabel("Søkeord og alternative navn").fill(alias);
		await page
			.getByLabel("Kort sammendrag")
			.fill("En egen testartikkel for å kontrollere publiseringsflyten.");
		await page
			.locator('[contenteditable="true"]')
			.fill("Dette er en test av arbeidsflyten, med innhold som skal bevares i historikken.");
		await page.getByRole("button", { name: "Lagre utkast", exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/wiki/${slug}/edit$`));
		await page.getByRole("button", { name: "Forhåndsvis", exact: true }).click();
		await expect(
			page.getByText("Dette er en test av arbeidsflyten", { exact: false }).first(),
		).toBeVisible();
		await page.getByRole("button", { name: "Publiser", exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/wiki/${slug}$`));
		await page.getByRole("button", { name: "Lagre bokmerke" }).click();
		await expect(page.getByRole("button", { name: "Lagret", exact: true })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await page.getByRole("link", { name: "Bokmerker", exact: true }).click();
		await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
		await page.goto(`/wiki?q=${alias}`);
		await page.getByRole("link", { name: new RegExp(title) }).click();
		await page.getByRole("button", { name: "Meld fra om feil" }).click();
		await page.getByLabel("Hva bør rettes?").fill("Testmeldingen kan lukkes etter verifisering.");
		await page.getByRole("button", { name: "Send feilmelding" }).click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await page.getByRole("button", { name: "Historikk", exact: true }).click();
		await expect(page.getByText(/Versjon 1: Utkast lagret/)).toBeVisible();
		await expect(page.getByText(/Versjon 2: Publisert/)).toBeVisible();
		await page.keyboard.press("Escape");
		await page.getByRole("button", { name: "Ta artikkelen ut av bruk", exact: true }).click();
		await page
			.getByLabel("Hvorfor tas artikkelen ut av bruk?")
			.fill("Testen er ferdig. Dette var en lokal testartikkel.");
		await page.getByRole("button", { name: "Ta ut av bruk", exact: true }).click();
		await expect(
			page.getByRole("heading", { name: "Denne artikkelen er tatt ut av bruk" }),
		).toBeVisible();
		await page.goto(`/wiki?q=${alias}`);
		await expect(page.getByRole("heading", { name: "Ingen artikler funnet" })).toBeVisible();
		await page.goto("/wiki/review");
		const report = page.locator("article").filter({ hasText: title }).first();
		await report.getByRole("button", { name: "Marker som løst" }).click();
	});
});
