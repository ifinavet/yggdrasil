import { describe, expect, it } from "vitest";
import {
	deadlineIsSoon,
	matchesSearch,
	type OverviewListing,
	publicListingUrl,
	splitIntoSections,
} from "./sections";

const NOW = Date.parse("2026-09-27T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function listing(overrides: Partial<OverviewListing> = {}): OverviewListing {
	return {
		_id: "listing1" as OverviewListing["_id"],
		_creationTime: NOW - 30 * DAY,
		title: "Sommerjobb utvikler",
		type: "Sommerjobb",
		teaser: "",
		description: "",
		applicationUrl: "",
		published: true,
		company: "company1" as OverviewListing["company"],
		deadline: NOW + 30 * DAY,
		companyName: "Bekk",
		companyLogo: "",
		...overrides,
	} as OverviewListing;
}

describe("splitIntoSections", () => {
	const draft = listing({ _id: "draft" as OverviewListing["_id"], published: false });
	const later = listing({ _id: "later" as OverviewListing["_id"], deadline: NOW + 60 * DAY });
	const sooner = listing({ _id: "sooner" as OverviewListing["_id"], deadline: NOW + 2 * DAY });
	const oldDraft = listing({
		_id: "oldDraft" as OverviewListing["_id"],
		published: false,
		deadline: NOW - 10 * DAY,
	});
	const oldLive = listing({ _id: "oldLive" as OverviewListing["_id"], deadline: NOW - DAY });

	it("splits drafts, live listings by soonest deadline, and expired listings by latest deadline", () => {
		const sections = splitIntoSections([later, oldDraft, draft, sooner, oldLive], NOW);

		expect(sections.unpublished.map((l) => l._id)).toEqual(["draft"]);
		expect(sections.published.map((l) => l._id)).toEqual(["sooner", "later"]);
		expect(sections.expired.map((l) => l._id)).toEqual(["oldLive", "oldDraft"]);
	});

	it("filters every section by the search", () => {
		const other = listing({ _id: "other" as OverviewListing["_id"], companyName: "DNB" });
		const sections = splitIntoSections([draft, other, oldLive], NOW, "dnb");

		expect(sections.unpublished).toEqual([]);
		expect(sections.published.map((l) => l._id)).toEqual(["other"]);
		expect(sections.expired).toEqual([]);
	});
});

describe("matchesSearch", () => {
	it("matches title, company and type", () => {
		const item = listing({ title: "Graduate data", companyName: "DNB", type: "Fulltid" });

		expect(matchesSearch(item, "graduate")).toBe(true);
		expect(matchesSearch(item, "dnb")).toBe(true);
		expect(matchesSearch(item, "fulltid")).toBe(true);
		expect(matchesSearch(item, "bekk")).toBe(false);
	});
});

describe("deadlineIsSoon", () => {
	it("flags deadlines within seven days", () => {
		expect(deadlineIsSoon({ deadline: NOW + 6 * DAY }, NOW)).toBe(true);
		expect(deadlineIsSoon({ deadline: NOW + 8 * DAY }, NOW)).toBe(false);
	});
});

describe("publicListingUrl", () => {
	it("points at the listing on ifinavet.no", () => {
		expect(publicListingUrl({ _id: "abc" as OverviewListing["_id"] })).toBe(
			"https://ifinavet.no/job-listings/abc",
		);
	});
});
