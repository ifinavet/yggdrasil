import { expect, type Page, test } from "@playwright/test";
import { bifrostUrl, clearCookieNotice, convexUrl } from "./production-helpers";
import { type EventsSeedScenario, seedEvents } from "./seed-events";

function hint(page: Page, text: RegExp) {
	return page.getByRole("dialog", { name: text });
}

async function open(page: Page, path: string, scenario: EventsSeedScenario) {
	await seedEvents(convexUrl, scenario);
	await page.goto(`${bifrostUrl}${path}`);
	await clearCookieNotice(page);
}

async function dismiss(page: Page, text: RegExp) {
	const popover = hint(page, text);
	await expect(popover).toBeVisible();
	await popover.getByRole("button", { name: "Skjønner" }).click();
	await expect(popover).toBeHidden();
}

const search = /Søk på tittel, bedrift/;
const semester = /Listen viser ett semester/;
const create = /Lag et nytt arrangement\. Lagre/;
const mine = /Her ligger arrangementene der du er ansvarlig/;
const past = /Arrangementer som er over/;
const checklist = /Sjekklisten har fem faser/;
const registrations = /Åpne Påmeldte for å se/;
const email = /Send e-post åpner/;
const report = /Rapporten viser påmeldte/;

test.describe("events guide", () => {
	test.describe.configure({ mode: "serial" });
	test.use({ storageState: { cookies: [], origins: [] } });

	test("walks through every step on the events list", async ({ page }) => {
		await open(page, "/events", "organizer");
		for (const step of [search, semester, create, mine, past]) await dismiss(page, step);
		await expect(page.locator('[role="dialog"]')).toHaveCount(0);
	});

	test("skips the own-events step when the user organizes nothing", async ({ page }) => {
		await open(page, "/events", "empty");
		for (const step of [search, semester, create]) await dismiss(page, step);
		await expect(hint(page, mine)).toBeHidden();
		await expect(page.locator('[data-tour="mine"]')).toHaveCount(0);
	});

	test("a dismissed hint stays away until replayed", async ({ page }) => {
		await open(page, "/events", "organizer");
		await dismiss(page, search);
		await page.reload();
		await expect(page.locator('[data-tour="search"]')).toBeVisible();
		await expect(hint(page, search)).toBeHidden();
		await page.getByRole("button", { name: "Vis veiledningen igjen" }).click();
		await expect(hint(page, search)).toBeVisible();
	});

	test("moves on when the anchored control is used", async ({ page }) => {
		await open(page, "/events", "organizer");
		await expect(hint(page, search)).toBeVisible();
		await page.getByPlaceholder("Arrangement, bedrift eller person").click();
		await expect(hint(page, search)).toBeHidden();
		await expect(hint(page, semester)).toBeVisible();
	});

	test("guides the event page and skips the email step there", async ({ page }) => {
		await open(page, "/events/seed-events-mine", "organizer");
		await dismiss(page, checklist);
		await dismiss(page, registrations);
		await dismiss(page, report);
		await expect(page.locator('[role="dialog"]')).toHaveCount(0);
	});

	test("shows the email step on the registrations page", async ({ page }) => {
		await open(page, "/events/seed-events-mine/registrations", "organizer");
		await expect(hint(page, checklist)).toBeHidden();
		await expect(hint(page, registrations)).toBeHidden();
		await dismiss(page, email);
		await dismiss(page, report);
	});

	test("only offers the checklist for an external event", async ({ page }) => {
		await open(page, "/events/seed-events-external", "external");
		await dismiss(page, checklist);
		await expect(page.locator('[role="dialog"]')).toHaveCount(0);
	});

	test("keeps every hint on screen at phone width", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await open(page, "/events", "organizer");
		for (const step of [search, semester, create, mine, past]) {
			await expect(hint(page, step)).toBeInViewport({ ratio: 1 });
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
			).toBe(0);
			await dismiss(page, step);
		}
	});
});
