import { expect, test } from "@playwright/test";
import { FOOD_ITEM_LABELS } from "@workspace/shared/events/food";
import { bifrostUrl, clearCookieNotice, convexUrl } from "./production-helpers";
import { seedEvents } from "./seed-events";

test("shows the food and location fields once the food choices have loaded", async ({ page }) => {
	await seedEvents(convexUrl, "organizer");
	await page.goto(`${bifrostUrl}/events/seed-events-mine`);
	await clearCookieNotice(page);
	const food = page.getByRole("combobox", { name: "Mat" });
	await expect(food).toHaveText(FOOD_ITEM_LABELS.pizza);
	await expect(food).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Sted" })).toBeVisible();
});
