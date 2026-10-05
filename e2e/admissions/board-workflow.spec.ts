import { expect, test } from "@playwright/test";
import { formatOsloDate } from "@workspace/shared/time";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	resetAdmissions,
} from "./production-helpers";

test("creates a period and exposes calendar provider configuration errors", async ({ page }) => {
	await resetAdmissions("open");
	const fixture = await admissionsOverview();
	expect(fixture).not.toBeNull();
	await resetAdmissions("empty");
	await page.goto(`${bifrostUrl}/admissions`);
	await clearCookieNotice(page);
	await expect(page.getByRole("heading", { name: "Ingen aktive opptak" })).toBeVisible();
	await captureScreenshot(
		page,
		"board",
		"live-11-empty.png",
		page.getByRole("heading", { name: "Opptak", exact: true }),
	);
	await page.getByRole("button", { name: "Start opptak" }).click();
	const settings = page.getByRole("dialog", { name: "Start opptak" });
	await settings.getByLabel("Navn", { exact: true }).fill("Høst 2026");
	for (const [key, label] of [
		["applicationStartAt", "Søknader åpner"],
		["applicationEndAt", "Søknadsfrist"],
		["interviewStartAt", "Første intervjudag"],
		["interviewEndAt", "Siste intervjudag"],
		["retentionAt", "Slett opplysningene"],
	] as const) {
		await settings
			.getByLabel(label, { exact: true })
			.fill(formatOsloDate(fixture?.period[key] ?? 0, "yyyy-MM-dd'T'HH:mm"));
	}
	await settings.getByRole("checkbox", { name: "Kristin Berg" }).check();
	await settings.getByRole("checkbox", { name: "Daniel Holm" }).check();
	await captureScreenshot(page, "board", "live-12-create.png", settings);
	await settings.getByRole("button", { name: "Start opptak", exact: true }).click();
	await expect(settings).toBeHidden();
	await page.getByRole("button", { name: "Kalendere", exact: true }).click();
	const calendars = page.getByRole("dialog", { name: "Kalendere" });
	await calendars.getByRole("button", { name: "Hent kalendere for Kristin Berg" }).click();
	await expect(calendars.getByRole("alert")).toContainText(/kalender|Calendar/i);
	await expect(calendars.getByRole("checkbox", { name: "Privat", exact: true })).toHaveCount(0);
	await captureScreenshot(page, "board", "live-13-calendars.png", calendars);
	await page.keyboard.press("Escape");
	const saved = await admissionsOverview();
	expect(saved?.period.interviewers).toHaveLength(2);
	expect(
		saved?.period.interviewers.every((person) => person.selectedCalendarIds.length === 0),
	).toBe(true);
});

test("selection rounds are reversible and decisions send only on explicit confirmation", async ({
	page,
}) => {
	await resetAdmissions("open");
	await page.goto(`${bifrostUrl}/admissions`);
	await clearCookieNotice(page);
	await page.getByRole("button", { name: "Utvelgelse", exact: true }).click();
	const initial = await admissionsOverview();
	const candidate = initial?.candidates[0];
	const select = page.getByRole("combobox", { name: `Flytt ${candidate?.name}` });
	await select.click();
	await page.getByRole("option", { name: "Videre", exact: true }).click();
	await page.getByRole("button", { name: "Neste runde", exact: true }).click();
	await expect(page.getByText("Runde 2", { exact: true })).toBeVisible();
	await captureScreenshot(
		page,
		"board",
		"live-14-selection.png",
		page.getByRole("heading", { name: "Opptak", exact: true }),
	);
	expect(
		(await admissionsOverview())?.jobs.filter((job) => job.kind === "send_decision"),
	).toHaveLength(0);
	await page.getByRole("button", { name: "Forrige runde", exact: true }).click();
	await expect(page.getByText("Runde 1", { exact: true })).toBeVisible();
	await resetAdmissions("decisions");
	await page.reload();
	await page.getByRole("button", { name: /^Send svar \(/ }).click();
	const send = page.getByRole("dialog", { name: "Send svar til kandidatene?" });
	await expect(send).toContainText("10 avslag");
	await captureScreenshot(page, "board", "live-15-send-decisions.png", send);
	expect(
		(await admissionsOverview())?.jobs.filter((job) => job.kind === "send_decision"),
	).toHaveLength(0);
	await send.getByRole("button", { name: "Send svar", exact: true }).click();
	await expect(send).toBeHidden();
	await expect
		.poll(
			async () =>
				(await admissionsOverview())?.jobs.filter((job) => job.kind === "send_decision").length,
		)
		.toBe(10);
	await expect(page.getByRole("button", { name: "Send svar (0)", exact: true })).toBeDisabled();
	expect(
		(await admissionsOverview())?.candidates.filter(
			(candidate) => candidate.decisionQueuedAt !== undefined,
		),
	).toHaveLength(10);
	await page.reload();
	expect(
		(await admissionsOverview())?.jobs.filter((job) => job.kind === "send_decision"),
	).toHaveLength(10);
});
