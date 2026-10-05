import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";

export async function captureScreenshot(
	page: Page,
	app: "student" | "board",
	name: string,
	target: Locator,
	viewport?: { width: number; height: number },
) {
	// biome-ignore lint/suspicious/noUndeclaredEnvVars: Screenshot artifacts are opt-in and outside Turbo.
	if (process.env.ADMISSIONS_SCREENSHOTS !== "1") return;
	if (viewport) await page.setViewportSize(viewport);
	await target.scrollIntoViewIfNeeded();
	await page.screenshot({ path: join("test-results/admissions/screenshots", app, name) });
}
