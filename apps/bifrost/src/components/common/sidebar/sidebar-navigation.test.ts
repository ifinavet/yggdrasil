import type { GatedFeature } from "@workspace/shared/feature-flags";
import { describe, expect, it } from "vitest";
import { type SidebarSection, sidebarNavigation, visibleSections } from "./sidebar-navigation";

function flags(overrides: Partial<Record<GatedFeature, boolean>> = {}) {
	return {
		huginFeedback: false,
		products: false,
		jobListingOrders: false,
		semesterPlanning: false,
		engagement: false,
		eventReminders: false,
		...overrides,
	};
}

function titles(sections: SidebarSection[]) {
	return sections.map((section) => [section.title, section.items.map((item) => item.title)]);
}

describe("visibleSections", () => {
	it("groups every admin page under a named subsection when all features are on", () => {
		const sections = visibleSections("admin", flags({ products: true, semesterPlanning: true }));

		expect(titles(sections)).toEqual([
			["Personer", ["Studenter", "Organisasjon"]],
			["Bedrifter og økonomi", ["Bedrifter", "Produkter", "Fakturaer"]],
			["Planlegging", ["Semesterplan", "Mat", "Skjemaer"]],
		]);
	});

	it("hides gated items while keeping the rest of their subsection", () => {
		const sections = visibleSections("admin", flags());

		expect(titles(sections)).toEqual([
			["Personer", ["Studenter", "Organisasjon"]],
			["Bedrifter og økonomi", ["Bedrifter"]],
			["Planlegging", ["Mat", "Skjemaer"]],
		]);
	});

	it("hides gated items in untitled groups", () => {
		const hidden = visibleSections("main", flags()).flatMap((section) => section.items);
		const shown = visibleSections("main", flags({ engagement: true })).flatMap(
			(section) => section.items,
		);

		expect(hidden.map((item) => item.title)).not.toContain("Innsikt");
		expect(shown.map((item) => item.title)).toContain("Innsikt");
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
