import { DAY_MS, HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import {
	ALERT_ACTIVITY,
	activityBuckets,
	activityWindowMs,
	classify,
	fillCurve,
	isSimilarCapacity,
	isWave,
	medianCurve,
	PACE_STEPS,
	progressOf,
	projectFill,
	recentUnregistrations,
	seatDelta,
	valueAt,
} from "./metrics";

const OPENS = Date.UTC(2026, 8, 1, 10);
const START = OPENS + 10 * DAY_MS;
const TIMELINE = { registrationOpens: OPENS, eventStart: START };

function linearCurve(finalFill: number) {
	return Array.from({ length: PACE_STEPS + 1 }, (_, step) => (finalFill * step) / PACE_STEPS);
}

describe("progressOf", () => {
	it("clamps progress to the registration window", () => {
		expect(progressOf(TIMELINE, OPENS - DAY_MS)).toBe(0);
		expect(progressOf(TIMELINE, OPENS + 5 * DAY_MS)).toBe(0.5);
		expect(progressOf(TIMELINE, START + DAY_MS)).toBe(1);
	});

	it("treats an empty window as finished", () => {
		expect(progressOf({ registrationOpens: START, eventStart: START }, OPENS)).toBe(1);
	});
});

describe("fillCurve", () => {
	it("counts registrations up to each step and caps at the limit", () => {
		const curve = fillCurve(TIMELINE, 2, [START, OPENS, OPENS + DAY_MS, OPENS + 2 * DAY_MS]);
		expect(curve).toHaveLength(PACE_STEPS + 1);
		expect(curve[0]).toBe(0.5);
		expect(curve[2]).toBe(1);
		expect(curve[PACE_STEPS]).toBe(1);
	});
});

describe("medianCurve", () => {
	it("returns null without curves", () => {
		expect(medianCurve([])).toBeNull();
	});

	it("takes the middle value for an odd count", () => {
		const median = medianCurve([linearCurve(0.2), linearCurve(0.9), linearCurve(0.5)]);
		expect(median?.[PACE_STEPS]).toBe(0.5);
	});

	it("averages the two middle values for an even count and fills gaps with zero", () => {
		const median = medianCurve([linearCurve(0.4), linearCurve(0.8), []]);
		expect(median?.[PACE_STEPS]).toBeCloseTo(0.4);
		const even = medianCurve([linearCurve(0.4), linearCurve(0.8)]);
		expect(even?.[PACE_STEPS]).toBeCloseTo(0.6);
	});
});

describe("valueAt", () => {
	it("interpolates between steps and holds the last step", () => {
		const curve = linearCurve(1);
		expect(valueAt(curve, 0.525)).toBeCloseTo(0.525);
		expect(valueAt(curve, 1)).toBe(1);
	});
});

describe("isSimilarCapacity", () => {
	it("accepts limits within half the capacity", () => {
		expect(isSimilarCapacity(40, 60)).toBe(true);
		expect(isSimilarCapacity(40, 61)).toBe(false);
	});
});

describe("projectFill", () => {
	it("returns the current fill before registration opens", () => {
		expect(projectFill(0.3, 0, linearCurve(1))).toBe(0.3);
	});

	it("extrapolates linearly without a baseline", () => {
		expect(projectFill(0.2, 0.5, null)).toBeCloseTo(0.4);
		expect(projectFill(0.8, 0.5, null)).toBe(1);
	});

	it("scales the baseline end fill by the current ratio", () => {
		expect(projectFill(0.2, 0.5, linearCurve(0.8))).toBeCloseTo(0.4);
	});

	it("returns the current fill when the baseline expects nothing yet", () => {
		expect(projectFill(0.1, 0.5, linearCurve(0))).toBe(0.1);
	});
});

describe("seatDelta", () => {
	it("adds taken seats and subtracts only released registered seats", () => {
		expect(
			seatDelta([
				{ change: "registered", at: 1 },
				{ change: "accepted", at: 2 },
				{ change: "unregistered", fromStatus: "registered", at: 3 },
				{ change: "cleared", fromStatus: "registered", at: 4 },
				{ change: "unregistered", fromStatus: "waitlist", at: 5 },
				{ change: "waitlisted", at: 6 },
			]),
		).toBe(0);
	});
});

describe("recentUnregistrations", () => {
	it("keeps unregistrations inside the wave window", () => {
		const now = OPENS + DAY_MS;
		const recent = recentUnregistrations(
			[
				{ change: "unregistered", at: now - HOUR_MS },
				{ change: "unregistered", at: now - 30 * MINUTE_MS },
				{ change: "registered", at: now - MINUTE_MS },
				{ change: "unregistered", at: now + MINUTE_MS },
			],
			now,
		);
		expect(recent.map(({ at }) => at)).toEqual([now - 30 * MINUTE_MS]);
	});
});

describe("isWave", () => {
	it("needs both enough unregistrations and a large enough share", () => {
		expect(isWave(5, 45)).toBe(true);
		expect(isWave(4, 10)).toBe(false);
		expect(isWave(5, 46)).toBe(false);
	});
});

describe("classify", () => {
	const base = {
		timeline: TIMELINE,
		limit: 10,
		registrationTimes: [] as number[],
		unregistrations: 0,
		baseline: null,
	};

	it("reports events that have not opened", () => {
		expect(classify({ ...base, now: OPENS - 1 })).toEqual({ kind: "notOpen", opensAt: OPENS });
	});

	it("prefers a wave over every other status", () => {
		expect(classify({ ...base, now: OPENS + DAY_MS, unregistrations: 5 })).toEqual({
			kind: "wave",
			count: 5,
		});
	});

	it("reports how fast a full event filled", () => {
		const registrationTimes = Array.from({ length: 10 }, (_, index) => OPENS + index * MINUTE_MS);
		expect(classify({ ...base, now: OPENS + DAY_MS, registrationTimes })).toEqual({
			kind: "full",
			minutesToFull: 9,
		});
		expect(
			classify({ ...base, now: OPENS + DAY_MS, registrationTimes: Array(10).fill(OPENS) }),
		).toEqual({ kind: "full", minutesToFull: 1 });
	});

	it("flags no registrations only after a day", () => {
		expect(classify({ ...base, now: OPENS + DAY_MS })).toEqual({ kind: "noRegistrations" });
		expect(classify({ ...base, now: OPENS + HOUR_MS })).toEqual({ kind: "onPace" });
	});

	it("flags events projected to stay under half full close to start", () => {
		const registrationTimes = [OPENS + HOUR_MS, OPENS + 2 * HOUR_MS];
		expect(classify({ ...base, now: START - DAY_MS, registrationTimes })).toEqual({
			kind: "behind",
		});
		expect(classify({ ...base, now: OPENS + 2 * DAY_MS, registrationTimes })).toEqual({
			kind: "onPace",
		});
	});

	it("flags events well ahead of the baseline", () => {
		const registrationTimes = Array.from({ length: 6 }, (_, index) => OPENS + index * HOUR_MS);
		const now = OPENS + 5 * DAY_MS;
		expect(classify({ ...base, now, registrationTimes, baseline: linearCurve(0.8) })).toEqual({
			kind: "ahead",
		});
		expect(classify({ ...base, now, registrationTimes, baseline: linearCurve(1.2) })).toEqual({
			kind: "onPace",
		});
	});
});

describe("activityBuckets", () => {
	it("spans the rule window", () => {
		expect(activityWindowMs("unregisterWave")).toBe(2 * HOUR_MS);
		expect(activityWindowMs("behindPace")).toBe(14 * DAY_MS);
	});

	it("counts the rule's change per bucket up to now", () => {
		const now = OPENS + 30 * DAY_MS;
		const from = now - activityWindowMs("unregisterWave");
		const buckets = activityBuckets(
			[
				{ change: "unregistered", at: from + MINUTE_MS },
				{ change: "unregistered", at: from + 2 * MINUTE_MS },
				{ change: "registered", at: from + 3 * MINUTE_MS },
				{ change: "unregistered", at: now - MINUTE_MS },
				{ change: "unregistered", at: now + MINUTE_MS },
				{ change: "unregistered", at: from - MINUTE_MS },
			],
			"unregisterWave",
			OPENS,
			now,
		);
		expect(buckets).toHaveLength(ALERT_ACTIVITY.unregisterWave.buckets);
		expect(buckets[0]).toEqual({ start: from, count: 2 });
		expect(buckets.at(-1)?.count).toBe(1);
		expect(buckets.reduce((sum, { count }) => sum + count, 0)).toBe(3);
	});

	it("starts at registration opening when it is inside the window", () => {
		const buckets = activityBuckets(
			[{ change: "registered", at: OPENS + DAY_MS + HOUR_MS }],
			"noRegistrations",
			OPENS,
			OPENS + 2 * DAY_MS + HOUR_MS,
		);
		expect(buckets.map(({ count }) => count)).toEqual([0, 1, 0]);
		expect(buckets[0]?.start).toBe(OPENS);
	});

	it("returns one bucket when registration opens right now", () => {
		expect(activityBuckets([], "behindPace", OPENS, OPENS)).toEqual([{ start: OPENS, count: 0 }]);
	});
});
