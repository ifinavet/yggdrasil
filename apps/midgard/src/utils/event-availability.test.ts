import { describe, expect, it } from "vitest";
import { countdownLabel, spotsLabel } from "./event-availability";

describe("spotsLabel", () => {
	it("shows only the remaining spots while the event has room", () => {
		expect(spotsLabel(12, 28)).toBe("28 plasser igjen");
		expect(spotsLabel(49, 1)).toBe("1 plass igjen");
	});

	it("shows only the registered count when the event is full", () => {
		expect(spotsLabel(50, 0)).toBe("50 påmeldt");
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
