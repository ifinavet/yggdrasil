import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import { bifrostUrl, clearCookieNotice, resetAdmissions } from "./production-helpers";

test.describe("admissions settings and close flow", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		await resetAdmissions("scheduled");
		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
	});

	test("updates and persists the selected interviewer team after period creation", async ({
		page,
	}) => {
		await resetAdmissions("open");
		await page.reload();
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const settings = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		const daniel = settings.getByRole("checkbox", { name: "Daniel Holm" });
		const aksel = settings.getByRole("checkbox", { name: "Aksel Nilsen" });
		await expect(daniel).toBeChecked();
		await aksel.check();
		await daniel.uncheck();
		await captureScreenshot(page, "board", "live-07-settings.png", settings);
		await settings.getByRole("button", { name: "Lagre innstillinger" }).click();
		await expect(settings).toBeHidden();

		await page.getByRole("button", { name: "Innstillinger" }).click();
		const updated = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await expect(updated.getByRole("checkbox", { name: "Daniel Holm" })).not.toBeChecked();
		await expect(updated.getByRole("checkbox", { name: "Aksel Nilsen" })).toBeChecked();
	});

	test("allows teams of three and requires at least two interviewers", async ({ page }) => {
		await resetAdmissions("open");
		await page.reload();
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const settings = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		const save = settings.getByRole("button", { name: "Lagre innstillinger" });
		await expect(settings.getByRole("checkbox", { name: "Kristin Berg" })).toBeChecked();
		await expect(settings.getByRole("checkbox", { name: "Daniel Holm" })).toBeChecked();
		await settings.getByRole("checkbox", { name: "Aksel Nilsen" }).check();
		await expect(save).toBeEnabled();
		await save.click();
		await expect(settings).toBeHidden();
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const updated = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await expect(updated.getByRole("checkbox", { name: "Aksel Nilsen" })).toBeChecked();
		await expect(updated.getByRole("checkbox", { name: "Kristin Berg" })).toBeChecked();
		await expect(updated.getByRole("checkbox", { name: "Daniel Holm" })).toBeChecked();
		await updated.getByRole("checkbox", { name: "Daniel Holm" }).uncheck();
		await updated.getByRole("checkbox", { name: "Kristin Berg" }).uncheck();
		await expect(updated.getByRole("button", { name: "Lagre innstillinger" })).toBeDisabled();
	});

	test("keeps interviewers assigned to a published future interview", async ({ page }) => {
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const settings = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await settings.getByRole("checkbox", { name: "Aksel Nilsen" }).check();
		await settings.getByRole("checkbox", { name: "Daniel Holm" }).uncheck();
		await captureScreenshot(page, "board", "live-07-settings.png", settings);
		await settings.getByRole("button", { name: "Lagre innstillinger" }).click();
		await expect(settings.getByRole("alert")).toContainText("publiserte intervjuer");
		await page.keyboard.press("Escape");
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const reopened = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await expect(reopened.getByRole("checkbox", { name: "Daniel Holm" })).toBeChecked();
		await expect(reopened.getByRole("checkbox", { name: "Aksel Nilsen" })).not.toBeChecked();
	});

	test("shows closure counts and requires explicit confirmation before forced close", async ({
		page,
	}) => {
		await resetAdmissions("decisions");
		await page.reload();
		await page.getByRole("button", { name: "Innstillinger" }).click();
		await page.getByRole("button", { name: "Avslutt opptaket" }).click();

		const close = page.getByRole("alertdialog", { name: "Avslutte opptaket?" });
		await expect(close).toContainText("1 ventende tilbud");
		await expect(close).toContainText("1 kommende intervju");
		await expect(close).toContainText("10 usendte beslutninger");
		const confirm = close.getByRole("button", { name: "Bekreft avslutning" });
		await expect(confirm).toBeDisabled();
		await captureScreenshot(page, "board", "live-08-close.png", close);
		await close.getByRole("checkbox", { name: /avslutte opptaket nå/i }).check();
		await expect(confirm).toBeEnabled();
		await confirm.click();
		await expect(close).toBeHidden();
		await expect(page.getByRole("heading", { name: "Ingen aktive opptak" })).toBeVisible();
	});
});
