import { describe, expect, it } from "vitest";
import { matchesAny, searchFolds } from "./search";

describe("matchesAny", () => {
	it("matches everything without a search", () => {
		expect(matchesAny(["Bekk"], "  ")).toBe(true);
	});

	it("matches any text case-insensitively and ignores missing values", () => {
		expect(matchesAny([null, "Sommerjobb i Bekk"], " bekk ")).toBe(true);
		expect(matchesAny([undefined, "Bekk"], "Netcompany")).toBe(false);
	});
});

describe("searchFolds", () => {
	it("leaves the folds alone without a search", () => {
		expect(searchFolds("  ")).toEqual({ key: "", open: undefined });
	});

	it("opens the folds under a new key for every new search", () => {
		expect(searchFolds(" Bekk ")).toEqual({ key: "bekk", open: true });
		expect(searchFolds("Bekk").key).not.toBe(searchFolds("Netcompany").key);
	});
});
