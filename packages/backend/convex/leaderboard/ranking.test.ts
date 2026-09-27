import { describe, expect, it } from "vitest";
import { rankBy } from "./ranking";

describe("rankBy", () => {
	it("sorts by count, shares rank on ties and drops zero counts", () => {
		const ranked = rankBy(
			[
				{ name: "a", n: 2 },
				{ name: "b", n: 5 },
				{ name: "c", n: 0 },
				{ name: "d", n: 2 },
				{ name: "e", n: 1 },
			],
			({ n }) => n,
		);

		expect(ranked.map(({ name, rank, count }) => [name, rank, count])).toEqual([
			["b", 1, 5],
			["a", 2, 2],
			["d", 2, 2],
			["e", 4, 1],
		]);
	});
});
