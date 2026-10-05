import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	resetAdmissions,
} from "./production-helpers";

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
		const team = settings.getByRole("combobox", { name: "Intervjuere", exact: true });
		await expect(team).toContainText("Daniel Holm");
		await team.click();
		await page.getByRole("option", { name: "Aksel Nilsen", exact: true }).click();
		await page.getByRole("option", { name: "Daniel Holm", exact: true }).click();
		await page.keyboard.press("Escape");
		await captureScreenshot(page, "board", "live-07-settings.png", settings);
		await settings.getByRole("button", { name: "Lagre innstillinger" }).click();
		await expect(settings).toBeHidden();

		await page.getByRole("button", { name: "Innstillinger" }).click();
		const updated = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await expect(
			updated.getByRole("combobox", { name: "Intervjuere", exact: true }),
		).not.toContainText("Daniel Holm");
		await expect(updated.getByRole("combobox", { name: "Intervjuere", exact: true })).toContainText(
			"Aksel Nilsen",
		);
	});

	test("allows teams of three and requires at least two interviewers", async ({ page }) => {
		await resetAdmissions("open");
		await page.reload();
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const settings = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		const save = settings.getByRole("button", { name: "Lagre innstillinger" });
		await expect(
			settings.getByRole("combobox", { name: "Intervjuere", exact: true }),
		).toContainText("Kristin Berg");
		await expect(
			settings.getByRole("combobox", { name: "Intervjuere", exact: true }),
		).toContainText("Daniel Holm");
		await settings.getByRole("combobox", { name: "Intervjuere", exact: true }).click();
		await page.getByRole("option", { name: "Aksel Nilsen", exact: true }).click();
		await page.keyboard.press("Escape");
		await expect(save).toBeEnabled();
		await save.click();
		await expect(settings).toBeHidden();
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const updated = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await expect(updated.getByRole("combobox", { name: "Intervjuere", exact: true })).toContainText(
			"Aksel Nilsen",
		);
		await expect(updated.getByRole("combobox", { name: "Intervjuere", exact: true })).toContainText(
			"Kristin Berg",
		);
		await expect(updated.getByRole("combobox", { name: "Intervjuere", exact: true })).toContainText(
			"Daniel Holm",
		);
		await updated.getByRole("combobox", { name: "Intervjuere", exact: true }).click();
		await page.getByRole("option", { name: "Daniel Holm", exact: true }).click();
		await page.getByRole("option", { name: "Kristin Berg", exact: true }).click();
		await page.keyboard.press("Escape");
		await expect(updated.getByRole("button", { name: "Lagre innstillinger" })).toBeDisabled();
	});

	test("keeps interviewers assigned to a published future interview", async ({ page }) => {
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const settings = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await settings.getByRole("combobox", { name: "Intervjuere", exact: true }).click();
		await page.getByRole("option", { name: "Aksel Nilsen", exact: true }).click();
		await page.getByRole("option", { name: "Daniel Holm", exact: true }).click();
		await page.keyboard.press("Escape");
		await captureScreenshot(page, "board", "live-07-settings.png", settings);
		await settings.getByRole("button", { name: "Lagre innstillinger" }).click();
		await expect(settings.getByRole("alert")).toContainText("publiserte intervjuer");
		await settings.getByRole("button", { name: "Close", exact: true }).click();
		await expect(settings).toBeHidden();
		await page.getByRole("button", { name: "Innstillinger" }).click();
		const reopened = page.getByRole("dialog", { name: "Opptaksinnstillinger" });
		await expect(
			reopened.getByRole("combobox", { name: "Intervjuere", exact: true }),
		).toContainText("Daniel Holm");
		await expect(
			reopened.getByRole("combobox", { name: "Intervjuere", exact: true }),
		).not.toContainText("Aksel Nilsen");
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
		await expect(page.getByText("Opptaket avsluttes.", { exact: false })).toBeVisible();
		expect((await admissionsOverview())?.period.status).toBe("closing");
		expect((await admissionsOverview())?.jobs.some((job) => job.kind === "cancel_interview")).toBe(
			true,
		);
	});
});
