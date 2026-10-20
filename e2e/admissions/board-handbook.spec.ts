import { expect, test } from "@playwright/test";
import { api } from "@workspace/backend/convex/api";
import { ConvexHttpClient } from "convex/browser";
import { convexUrl } from "./production-helpers";

test.describe("Bifrost handbook", () => {
	test.beforeAll(async () => {
		const convex = new ConvexHttpClient(convexUrl);
		await convex.mutation(api.auth.local.signIn, {});
	});
	test("searches articles with one shared search field and a keyboard shortcut", async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") errors.push(message.text());
		});
		await page.goto("/wiki");
		const search = page.getByRole("searchbox", { name: "Søk i håndboken" });
		await expect(search).toHaveCount(1);
		await expect(
			page.getByRole("link", { name: "Registrere oppmøte og rette prikker", exact: true }),
		).toBeVisible();
		await expect(search.locator("..").locator("svg")).toHaveCount(0);
		await expect(search.locator("..").locator("kbd").last()).toHaveText("K");
		await page.screenshot({ path: test.info().outputPath("overview.png"), fullPage: true });
		const modifier =
			(await search.locator("..").locator("kbd").first().textContent()) === "⌘"
				? "Meta"
				: "Control";
		await page.keyboard.press(`${modifier}+k`);
		await expect(search).toBeFocused();
		await search.fill("prikksystem");
		await page
			.getByRole("link", { name: "Registrere oppmøte og rette prikker", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Registrere oppmøte og rette prikker", exact: true }),
		).toBeVisible();
		await expect(page.getByText("180 dager", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("button", { name: /bokmerke|kontrollert|Historikk|Meld fra/ }),
		).toHaveCount(0);
		await expect(page.getByRole("navigation", { name: "På denne siden" })).toHaveCount(0);
		await page.screenshot({ path: test.info().outputPath("article.png"), fullPage: true });
		await page.setViewportSize({ width: 390, height: 844 });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
		await page.screenshot({ path: test.info().outputPath("article-narrow.png"), fullPage: true });
		expect(errors).toEqual([]);
	});
	test("groups articles and supports mobile light and dark themes", async ({ page }) => {
		await page.goto("/wiki");
		await expect(page.getByRole("combobox", { name: "Kategori" })).toHaveCount(0);
		const search = page.getByRole("searchbox", { name: "Søk i håndboken" });
		const finance = page.getByRole("region", { name: "Økonomi og produkter" });
		await expect(
			finance.getByRole("link", {
				name: "Fakturere i Fiken",
				exact: true,
			}),
		).toBeVisible();
		await search.fill("zzzzingenartikkel");
		await expect(page.getByText("Ingen artikler funnet.", { exact: true })).toBeVisible();
		await expect(page.getByRole("region", { name: "Økonomi og produkter" })).toHaveCount(0);
		await search.clear();
		await expect(
			page.getByRole("link", { name: "Registrere oppmøte og rette prikker", exact: true }),
		).toBeVisible();
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole("searchbox")).toBeInViewport();
		const headingBox = await finance.getByRole("heading").boundingBox();
		const linkBox = await finance.getByRole("link", { name: "Fakturere i Fiken" }).boundingBox();
		expect(linkBox?.x).toBe(headingBox?.x);
		expect(linkBox?.y).toBeGreaterThanOrEqual((headingBox?.y ?? 0) + (headingBox?.height ?? 0));
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
		await page.screenshot({ path: test.info().outputPath("overview-narrow.png"), fullPage: true });
		await page.getByRole("button", { name: "Velg fargetema" }).click();
		await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
		await expect(page.locator("html")).toHaveClass(/dark/);
		await expect(page.getByRole("menuitemradio", { name: "Dark", exact: true })).toHaveCount(0);
		await page.screenshot({
			path: test.info().outputPath("overview-dark.png"),
			fullPage: true,
		});
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBe(0);
	});
	test("keeps text readable and controls usable at narrow widths and 200% text size", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/wiki");
		const search = page.getByRole("searchbox", { name: "Søk i håndboken" });
		const article = page.getByRole("link", { name: "Navets systemer", exact: true });
		await expect(article).toBeVisible();
		await expect(search).toHaveCSS("font-size", "16px");
		for (const control of [search.locator(".."), article]) {
			expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		}
		if (isMobile) {
			await search.tap();
			await expect(search).toBeFocused();
		}
		for (const width of [320, 768, 844, 1280]) {
			await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
			).toBeLessThanOrEqual(1);
		}
		await page.evaluate(() => {
			document.documentElement.style.fontSize = "200%";
		});
		await page.setViewportSize({ width: 768, height: 900 });
		await expect(search).toHaveCSS("font-size", "32px");
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
		).toBeLessThanOrEqual(1);
		await page
			.getByRole("link", { name: "Registrere oppmøte og rette prikker", exact: true })
			.click();
		await expect(page.locator("article .prose")).toBeVisible();
		await expect(page.locator("article .prose")).toHaveCSS("font-size", "32px");
		// Edited guides may contain long URLs; they must wrap without widening the page.
		await page.locator("article .prose").evaluate((element) => {
			const paragraph = document.createElement("p");
			paragraph.textContent = `https://example.invalid/${"lang-lenke".repeat(20)}`;
			element.append(paragraph);
		});
		for (const width of [320, 768, 844, 1280]) {
			await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
			).toBeLessThanOrEqual(1);
		}
	});
});
