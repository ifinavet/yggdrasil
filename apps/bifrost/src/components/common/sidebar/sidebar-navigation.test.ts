import type { GatedFeature } from "@workspace/shared/feature-flags";
import { describe, expect, it } from "vitest";
import { type SidebarSection, sidebarNavigation, visibleSections } from "./sidebar-navigation";

function flags(overrides: Partial<Record<GatedFeature, boolean>> = {}) {
	return {
		food: false,
		...overrides,
	};
}

function titles(sections: SidebarSection[]) {
	return sections.map((section) => [section.title, section.items.map((item) => item.title)]);
}

describe("visibleSections", () => {
	it("groups every admin page under a named subsection when all features are on", () => {
		const sections = visibleSections("admin", flags({ food: true }));

		expect(titles(sections)).toEqual([
			["Personer", ["Opptak", "Studenter", "Organisasjon"]],
			["Bedrifter og økonomi", ["Bedrifter", "Produkter", "Fakturaer"]],
			["Planlegging", ["Semesterplan", "Mat", "Skjemaer"]],
		]);
	});

	it("hides gated items while keeping the rest of their subsection", () => {
		const sections = visibleSections("admin", flags());

		expect(titles(sections)).toEqual([
			["Personer", ["Opptak", "Studenter", "Organisasjon"]],
			["Bedrifter og økonomi", ["Bedrifter", "Produkter", "Fakturaer"]],
			["Planlegging", ["Semesterplan", "Skjemaer"]],
		]);
	});

	it("shows Mat only when the food flag is on", () => {
		const items = (food: boolean) =>
			visibleSections("admin", flags({ food })).flatMap((section) =>
				section.items.map((item) => item.title),
			);

		expect(items(false)).not.toContain("Mat");
		expect(items(true)).toContain("Mat");
	});

	it("always shows Innsikt", () => {
		const titles = visibleSections("main", flags()).flatMap((section) =>
			section.items.map((item) => item.title),
		);

		expect(titles).toContain("Innsikt");
	});
});

describe("sidebarNavigation", () => {
	const groups: SidebarSection[][] = Object.values(sidebarNavigation);

	it("links each path from exactly one place", () => {
		const paths = groups.flat().flatMap((section) => section.items.map((item) => item.path));

		expect(new Set(paths).size).toBe(paths.length);
	});

	it("gives sibling subsections distinct titles", () => {
		for (const sections of groups) {
			const sectionTitles = sections.map((section) => section.title);

			expect(new Set(sectionTitles).size).toBe(sectionTitles.length);
		}
	});
});
