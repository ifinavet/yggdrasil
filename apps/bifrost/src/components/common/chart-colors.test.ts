import { describe, expect, it } from "vitest";
import { dimmed, heatTint, needsLightText, tinted } from "./chart-colors";

describe("chart colors", () => {
	it("mixes a color towards transparent", () => {
		expect(tinted("red", 42.4)).toBe("color-mix(in oklch, red 42%, transparent)");
		expect(dimmed("red")).toBe("color-mix(in oklch, red 35%, transparent)");
	});

	it("keeps faint heat visible and scales strong heat", () => {
		expect(heatTint("red", 0.01)).toBe("color-mix(in oklch, red 8%, transparent)");
		expect(heatTint("red", 0.75)).toBe("color-mix(in oklch, red 75%, transparent)");
	});

	it("switches to light text on strong heat", () => {
		expect(needsLightText(0.59)).toBe(false);
		expect(needsLightText(0.6)).toBe(true);
	});
});
