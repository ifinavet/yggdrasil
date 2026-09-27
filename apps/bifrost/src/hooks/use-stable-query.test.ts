import { describe, expect, it } from "vitest";
import { latestResult } from "./use-stable-query";

describe("latestResult", () => {
	it("keeps the stored result while the same key reloads", () => {
		expect(latestResult({ key: "a", result: 1 }, { key: "a", result: undefined })).toBe(1);
	});

	it("drops the stored result while a new key loads", () => {
		expect(latestResult({ key: "a", result: 1 }, { key: "b", result: undefined })).toBeUndefined();
	});

	it("takes the next result once it arrives", () => {
		expect(latestResult({ key: "a", result: 1 }, { key: "b", result: 2 })).toBe(2);
		expect(
			latestResult<number | null>({ key: "a", result: 1 }, { key: "a", result: null }),
		).toBeNull();
	});

	it("stays empty until the first result arrives", () => {
		expect(
			latestResult({ key: "", result: undefined }, { key: "", result: undefined }),
		).toBeUndefined();
	});
});
