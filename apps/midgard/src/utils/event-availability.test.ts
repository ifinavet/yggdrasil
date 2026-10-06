import { describe, expect, it } from "vitest";
import { countdownLabel, spotsLabel } from "./event-availability";

describe("spotsLabel", () => {
	it("stays neutral when plenty of spots are left", () => {
		expect(spotsLabel(42, 30)).toBe("42 påmeldt, 30 plasser igjen");
	});

	it("adds urgency at ten or fewer spots", () => {
		expect(spotsLabel(42, 10)).toBe("42 påmeldt, bare 10 plasser igjen!");
		expect(spotsLabel(49, 1)).toBe("49 påmeldt, bare 1 plass igjen!");
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
