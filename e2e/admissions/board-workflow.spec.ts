import { expect, test } from "@playwright/test";
import { formatOsloDate } from "@workspace/shared/time";
import { captureScreenshot } from "./capture-screenshot";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	failGoogle,
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
	await settings.getByRole("combobox", { name: "Intervjuere", exact: true }).click();
	await page.getByRole("option", { name: "Kristin Berg", exact: true }).click();
	await page.getByRole("option", { name: "Daniel Holm", exact: true }).click();
	await page.keyboard.press("Escape");
	await captureScreenshot(page, "board", "live-12-create.png", settings);
	await settings.getByRole("button", { name: "Start opptak", exact: true }).click();
	await expect(settings).toBeHidden();
	await failGoogle(true);
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
	const send = page.getByRole("alertdialog", { name: "Send svar til kandidatene?" });
	await expect(send).toContainText("10 avslag");
	await captureScreenshot(page, "board", "live-15-send-decisions.png", send);
	expect(
		(await admissionsOverview())?.jobs.filter((job) => job.kind === "send_decision"),
	).toHaveLength(0);
	const handled = (
		candidates: NonNullable<Awaited<ReturnType<typeof admissionsOverview>>>["candidates"],
	) =>
		candidates.filter(
			(candidate) =>
				candidate.decisionQueuedAt !== undefined || candidate.decisionSentAt !== undefined,
		).length;
	const before = handled((await admissionsOverview())?.candidates ?? []);
	await send.getByRole("button", { name: "Send svar", exact: true }).click();
	await expect(send).toBeHidden();
	await expect(page.getByRole("button", { name: "Send svar (0)", exact: true })).toBeDisabled();
	await expect
		.poll(async () => handled((await admissionsOverview())?.candidates ?? []))
		.toBe(before + 10);
	await page.reload();
	await expect(page.getByRole("button", { name: "Send svar (0)", exact: true })).toBeDisabled();
});

test("candidate program and year filters combine and can be cleared", async ({ page }) => {
	await resetAdmissions("open");
	const candidates = (await admissionsOverview())?.candidates ?? [];
	const candidate = candidates.find((entry) => entry.program && entry.year);
	expect(candidate).toBeDefined();
	if (!candidate) throw new Error("Fixture requires a candidate with a study profile");
	await page.goto(`${bifrostUrl}/admissions`);
	await clearCookieNotice(page);
	await page.getByRole("button", { name: /^Kandidater/ }).click();
	const rows = page.getByRole("table").getByRole("row");
	await expect(rows).toHaveCount(candidates.length + 1);
	const program = page.getByRole("combobox", { name: "Studieprogram", exact: true });
	const year = page.getByRole("combobox", { name: "Studieår", exact: true });
	await program.click();
	await page.getByRole("option", { name: candidate.program, exact: true }).click();
	const sameProgram = candidates.filter((entry) => entry.program === candidate.program);
	await expect(rows).toHaveCount(sameProgram.length + 1);
	await year.click();
	await page.getByRole("option", { name: `${candidate.year}. år`, exact: true }).click();
	await captureScreenshot(page, "board", "live-25-candidate-filters.png", page.getByRole("table"));
	const matched = sameProgram.filter((entry) => entry.year === candidate.year);
	await expect(rows).toHaveCount(matched.length + 1);
	for (const entry of matched) {
		await expect(rows.getByRole("button", { name: entry.name, exact: true })).toBeVisible();
	}
	await program.click();
	await page.getByRole("option", { name: "Alle linjer", exact: true }).click();
	await expect(rows).toHaveCount(
		candidates.filter((entry) => entry.year === candidate.year).length + 1,
	);
	await year.click();
	await page.getByRole("option", { name: "Alle år", exact: true }).click();
	await expect(rows).toHaveCount(candidates.length + 1);
	await expect(program).toHaveText("Alle linjer");
	await expect(year).toHaveText("Alle år");
});
