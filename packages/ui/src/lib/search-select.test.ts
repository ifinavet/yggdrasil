import { describe, expect, it } from "vitest";
import { createLatestGate, filterSearchItems, type SearchSelectItem } from "./search-select";

const items: SearchSelectItem[] = [
	{ id: "1", label: "Ola Nordmann", description: "ola@uio.no" },
	{ id: "2", label: "Kari Nordmann", description: "kari@ifi.uio.no" },
	{ id: "3", label: "Bjørn Ås" },
];

describe("filterSearchItems", () => {
	it("returns every item for an empty or blank query", () => {
		expect(filterSearchItems(items, "")).toBe(items);
		expect(filterSearchItems(items, "   ")).toBe(items);
	});

	it("matches case-insensitively, including æ, ø and å", () => {
		expect(filterSearchItems(items, "nordMANN").map((item) => item.id)).toEqual(["1", "2"]);
		expect(filterSearchItems(items, "ÅS").map((item) => item.id)).toEqual(["3"]);
	});

	it("searches the description too", () => {
		expect(filterSearchItems(items, "ifi.uio").map((item) => item.id)).toEqual(["2"]);
	});

	it("needs every word to match, in any order and across label and description", () => {
		expect(filterSearchItems(items, "nordmann kari").map((item) => item.id)).toEqual(["2"]);
		expect(filterSearchItems(items, "ola kari")).toEqual([]);
	});
});

describe("createLatestGate", () => {
	it("keeps only the newest request current", () => {
		const nextRequest = createLatestGate();
		const first = nextRequest();
		expect(first()).toBe(true);

		const second = nextRequest();
		expect(first()).toBe(false);
		expect(second()).toBe(true);
	});

	it("ignores a slow response that resolves after a newer one", async () => {
		const nextRequest = createLatestGate();
		const shown: string[] = [];
		const respond = (isLatest: () => boolean, result: string, delay: number) =>
			new Promise<void>((resolve) =>
				setTimeout(() => {
					if (isLatest()) shown.push(result);
					resolve();
				}, delay),
			);

		const slow = respond(nextRequest(), "ol", 20);
		const fast = respond(nextRequest(), "ola", 1);
		await Promise.all([slow, fast]);

		expect(shown).toEqual(["ola"]);
	});

	it("keeps separate gates independent", () => {
		const a = createLatestGate()();
		createLatestGate()();
		expect(a()).toBe(true);
	});
});
