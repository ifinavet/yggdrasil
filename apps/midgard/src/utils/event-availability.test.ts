import { describe, expect, it } from "vitest";
import { countdownLabel, spotsLabel } from "./event-availability";

describe("spotsLabel", () => {
	it("shows the remaining spots", () => {
		expect(spotsLabel(28)).toBe("28 plasser igjen");
		expect(spotsLabel(0)).toBe("0 plasser igjen");
	});

	it("uses singular for one spot", () => {
		expect(spotsLabel(1)).toBe("1 plass igjen");
	});
});

describe("countdownLabel", () => {
	const now = Date.UTC(2026, 9, 4, 12, 0);
	const hour = 60 * 60 * 1000;

	it("counts days ahead", () => {
		expect(countdownLabel(now + 3 * 24 * hour, now)).toBe("om 3 dager");
	});

	it("counts hours on the day", () => {
		expect(countdownLabel(now + 5 * hour, now)).toBe("om 5 timer");
	});

	it("is empty once the event has started", () => {
		expect(countdownLabel(now, now)).toBeNull();
		expect(countdownLabel(now - hour, now)).toBeNull();
	});
});
