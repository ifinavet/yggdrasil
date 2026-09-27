import { describe, expect, it } from "vitest";
import { latestResult } from "./use-stable-query";

describe("latestResult", () => {
	it("keeps the stored result while the next one is loading", () => {
		expect(latestResult({ count: 1 }, undefined)).toEqual({ count: 1 });
	});

	it("takes the next result once it arrives", () => {
		expect(latestResult({ count: 1 }, { count: 2 })).toEqual({ count: 2 });
		expect(latestResult(undefined, null)).toBeNull();
	});

	it("stays empty until the first result arrives", () => {
		expect(latestResult(undefined, undefined)).toBeUndefined();
	});
});
