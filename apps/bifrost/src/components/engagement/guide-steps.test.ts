import { describe, expect, it } from "vitest";
import { liveGuideSteps } from "./guide-steps";

const ready = {
	live: true,
	eventCount: 3,
	alertCount: 1,
	selected: true,
	curve: { projected: 42 },
};

describe("liveGuideSteps", () => {
	it("offers every step once the data has loaded", () => {
		expect([...liveGuideSteps(ready)].sort()).toEqual(["alerts", "past", "prognosis", "select"]);
	});

	it("offers nothing while the upcoming events are loading", () => {
		expect(liveGuideSteps({ ...ready, eventCount: undefined }).size).toBe(0);
	});

	it("waits for the selected curve so the prognosis step keeps its place in the order", () => {
		expect(liveGuideSteps({ ...ready, curve: undefined }).size).toBe(0);
	});

	it("offers nothing outside the live tab", () => {
		expect(liveGuideSteps({ ...ready, live: false }).size).toBe(0);
	});

	it("skips the prognosis when the curve has none", () => {
		expect(liveGuideSteps({ ...ready, curve: { projected: null } }).has("prognosis")).toBe(false);
		expect(liveGuideSteps({ ...ready, curve: null }).has("prognosis")).toBe(false);
	});

	it("skips selecting when there is only one event", () => {
		expect(liveGuideSteps({ ...ready, eventCount: 1 }).has("select")).toBe(false);
	});

	it("skips the alerts step without alerts", () => {
		expect(liveGuideSteps({ ...ready, alertCount: 0 }).has("alerts")).toBe(false);
	});

	it("only offers the tab hint when no event is upcoming", () => {
		expect([
			...liveGuideSteps({
				...ready,
				eventCount: 0,
				alertCount: 0,
				selected: false,
				curve: undefined,
			}),
		]).toEqual(["past"]);
	});
});
