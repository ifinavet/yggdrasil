import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import { bifrostUrl, clearCookieNotice, resetAdmissions } from "./production-helpers";

test("keeps board controls in the viewport and shows interviewer photos in both themes", async ({
	page,
}) => {
	await resetAdmissions("scheduled");
	await page.goto(`${bifrostUrl}/admissions`);
	await clearCookieNotice(page);
	await expect(page.locator(".admissions-calendar")).toHaveCSS("display", "grid");
	const days = page.locator(".admissions-day");
	const firstDay = await days.nth(0).boundingBox();
	const nextDay = await days.nth(1).boundingBox();
	if (!firstDay || !nextDay) throw new Error("Calendar days have no visible layout");
	expect(nextDay.x).toBeGreaterThan(firstDay.x + firstDay.width);
	expect(nextDay.y).toBe(firstDay.y);
	await expect(page.locator(".admissions-day-content").first()).toHaveCSS("display", "flex");

	for (const mode of ["Light", "Dark"]) {
		await page.getByRole("button", { name: "Velg fargetema", exact: true }).click();
		await page.getByRole("menuitemradio", { name: mode, exact: true }).click();
		await expect(page.getByRole("img", { name: "Kristin Berg", exact: true })).toBeVisible();
		await expect(page.getByRole("img", { name: "Daniel Holm", exact: true })).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		).toBe(true);
		await captureScreenshot(
			page,
			"board",
			`live-16-calendar-${mode.toLowerCase()}.png`,
			page.getByRole("heading", { name: "Opptak", exact: true }),
			{ width: 1440, height: 1000 },
		);
	}
	await page.locator(".admissions-interview").first().click();
	const candidate = page.getByRole("dialog");
	await expect(candidate.locator(".admissions-profile-layout")).toHaveCSS("display", "grid");
	const profile = await candidate.locator(".admissions-profile-main").boundingBox();
	const interview = await candidate.locator(".admissions-profile-interview").boundingBox();
	if (!profile || !interview) throw new Error("Candidate profile has no visible layout");
	expect(interview.x).toBeGreaterThan(profile.x + profile.width);
	await captureScreenshot(page, "board", "live-19-candidate.png", candidate);
	await candidate.getByRole("button", { name: "Close", exact: true }).click();
	await page.getByRole("button", { name: "Utvelgelse", exact: true }).click();
	const board = page.locator(".admissions-board");
	await expect(board).toHaveCSS("display", "grid");
	const lanes = page.locator(".admissions-lane");
	await expect(lanes).toHaveCount(4);
	const firstLane = await lanes.nth(0).boundingBox();
	const nextLane = await lanes.nth(1).boundingBox();
	if (!firstLane || !nextLane) throw new Error("Selection lanes have no visible layout");
	expect(nextLane.x).toBeGreaterThan(firstLane.x + firstLane.width);
	expect(nextLane.y).toBe(firstLane.y);
	await page.getByRole("button", { name: "Storskjerm", exact: true }).click();
	const fullscreen = page.locator(".admissions-fullscreen");
	await expect(fullscreen).toHaveCSS("position", "fixed");
	const bounds = await fullscreen.boundingBox();
	expect(bounds).toEqual({ x: 0, y: 0, ...page.viewportSize() });
	await captureScreenshot(page, "board", "live-18-selection-fullscreen.png", board);
	await page.getByRole("button", { name: "Avslutt storskjerm", exact: true }).click();
	await expect(fullscreen).toHaveCount(0);
	await page.getByRole("button", { name: "Intervjuer", exact: true }).click();
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	);
	await captureScreenshot(
		page,
		"board",
		"live-17-mobile.png",
		page.getByRole("heading", { name: "Opptak", exact: true }),
	);
});
