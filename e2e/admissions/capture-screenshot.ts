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
	await page.screenshot({ path: join("docs/admissions/screenshots", app, name) });
}

export async function captureEmail(
	page: Page,
	app: "student" | "board",
	name: string,
	html: string,
) {
	// biome-ignore lint/suspicious/noUndeclaredEnvVars: Screenshot artifacts are opt-in and outside Turbo.
	if (process.env.ADMISSIONS_SCREENSHOTS !== "1") return;
	const preview = await page.context().newPage();
	await preview.setContent(html);
	await captureScreenshot(preview, app, name, preview.locator("body"), {
		width: 900,
		height: 1100,
	});
	await preview.close();
}
