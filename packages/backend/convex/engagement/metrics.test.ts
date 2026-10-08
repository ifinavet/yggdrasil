import { DAY_MS, HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import {
	ALERT_ACTIVITY,
	activityBuckets,
	activityWindowMs,
	alignedCurve,
	classify,
	demandCurve,
	isWave,
	type LogEntry,
	medianCurve,
	PACE_GRID,
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
	return PACE_GRID.map((progress) => finalFill * progress);
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

describe("demandCurve", () => {
	const at = (progress: number) => OPENS + (START - OPENS) * progress;

	it("replays the students signed up at each grid point, beyond the limit", () => {
		const log: LogEntry[] = [
			{ change: "registered", at: OPENS },
			{ change: "registered", at: at(0.1) },
			{ change: "registered", at: at(0.2) },
			{ change: "registered", at: START + DAY_MS },
		];
		const curve = demandCurve(TIMELINE, 2, log);
		expect(curve).toHaveLength(PACE_GRID.length);
		expect(curve[0]).toBe(0.5);
		expect(curve[PACE_GRID.indexOf(0.1)]).toBe(1);
		expect(curve.at(-1)).toBe(1.5);
	});

	it("counts the waitlist and ignores moves between the waitlist and a seat", () => {
		const log: LogEntry[] = [
			{ change: "registered", at: OPENS },
			{ change: "registered", at: OPENS + 1 },
			{ change: "waitlisted", at: OPENS + 2 },
			{ change: "unregistered", fromStatus: "registered", at: at(0.5) },
			{ change: "offered", at: at(0.5) },
			{ change: "accepted", at: at(0.6) },
		];
		const curve = demandCurve(TIMELINE, 2, log);
		expect(curve[PACE_GRID.indexOf(0.0001)]).toBe(1.5);
		expect(curve[PACE_GRID.indexOf(0.5)]).toBe(1);
		expect(curve[PACE_GRID.indexOf(0.6)]).toBe(1);
	});

	it("resolves the first minutes of registration", () => {
		const log: LogEntry[] = [{ change: "registered", at: at(0.0003) }];
		const curve = demandCurve(TIMELINE, 1, log);
		expect(curve[PACE_GRID.indexOf(0.0002)]).toBe(0);
		expect(curve[PACE_GRID.indexOf(0.0005)]).toBe(1);
	});

	it("never drops below zero", () => {
		const log: LogEntry[] = [{ change: "cleared", fromStatus: "registered", at: OPENS }];
		expect(demandCurve(TIMELINE, 2, log)[0]).toBe(0);
	});
});

describe("medianCurve", () => {
	it("returns null without curves", () => {
		expect(medianCurve([])).toBeNull();
	});

	it("takes the middle value for an odd count", () => {
		const median = medianCurve([linearCurve(0.2), linearCurve(0.9), linearCurve(0.5)]);
		expect(median?.at(-1)).toBe(0.5);
	});

	it("averages the two middle values for an even count and fills gaps with zero", () => {
		const median = medianCurve([linearCurve(0.4), linearCurve(0.8), []]);
		expect(median?.at(-1)).toBeCloseTo(0.4);
		const even = medianCurve([linearCurve(0.4), linearCurve(0.8)]);
		expect(even?.at(-1)).toBeCloseTo(0.6);
	});
});

describe("valueAt", () => {
	it("interpolates between steps and holds the last step", () => {
		const curve = linearCurve(1);
		expect(valueAt(curve, 0.525)).toBeCloseTo(0.525);
		expect(valueAt(curve, 1)).toBe(1);
		expect(valueAt(curve, 2)).toBe(1);
	});

	it("interpolates on the dense early grid", () => {
		const curve = PACE_GRID.map((progress) => (progress >= 0.0002 ? 1 : 0));
		expect(valueAt(curve, 0)).toBe(0);
		expect(valueAt(curve, 0.00015)).toBeCloseTo(0.5);
		expect(valueAt(curve, 0.0002)).toBe(1);
	});
});

describe("projectFill", () => {
	it("returns the current fill before registration opens", () => {
		expect(projectFill(0.3, 0, linearCurve(1))).toBe(0.3);
	});

	it("does not invent growth without a baseline", () => {
		expect(projectFill(0.2, 0.5, null)).toBe(0.2);
		expect(projectFill(0.8, 0.5, null)).toBe(0.8);
	});

	it("adds the growth the baseline still has ahead", () => {
		expect(projectFill(0.2, 0.5, linearCurve(0.8))).toBeCloseTo(0.6);
	});

	it("stays stable when the baseline has barely started", () => {
		expect(projectFill(0.05, 0.0001, linearCurve(0.5))).toBeCloseTo(0.55 - 0.00005);
	});

	it("allows historical decline while clamping to zero and capacity", () => {
		const shrinking = PACE_GRID.map((progress) => 0.8 - 0.2 * progress);
		expect(projectFill(0.3, 0.5, shrinking)).toBeCloseTo(0.2);
		expect(projectFill(0.05, 0.5, shrinking)).toBe(0);
		expect(projectFill(0.1, 0.5, linearCurve(0))).toBe(0.1);
		expect(projectFill(0.9, 0.5, linearCurve(1))).toBe(1);
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
		expect(classify({ ...base, now: OPENS + HOUR_MS })).toEqual({ kind: "open" });
	});

	it("leaves an open event with registrations unflagged however slow it fills", () => {
		const registrationTimes = [OPENS + HOUR_MS, OPENS + 2 * HOUR_MS];
		expect(classify({ ...base, now: START - DAY_MS, registrationTimes })).toEqual({ kind: "open" });
	});
});

describe("activityBuckets", () => {
	it("spans the rule window", () => {
		expect(activityWindowMs("unregisterWave")).toBe(2 * HOUR_MS);
		expect(activityWindowMs("noRegistrations")).toBe(14 * DAY_MS);
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
		expect(activityBuckets([], "noRegistrations", OPENS, OPENS)).toEqual([
			{ start: OPENS, count: 0 },
		]);
	});
});

describe("historical forecast shape", () => {
	it("rises, drops after a reminder, and recovers from the current count", () => {
		const curve = PACE_GRID.map((p) => (p < 0.7 ? 0.4 + p / 2 : p < 0.85 ? 0.35 : 0.5));
		expect(projectFill(0.6, 0.5, curve, 0.6)).toBeCloseTo(0.65);
		expect(projectFill(0.6, 0.5, curve, 0.75)).toBeCloseTo(0.3);
		expect(projectFill(0.6, 0.5, curve, 1)).toBeCloseTo(0.45);
	});
	it("aligns the two-day reminder across different registration windows", () => {
		const source = { registrationOpens: 0, eventStart: 10 * DAY_MS, remindersEnabled: true };
		const target = { registrationOpens: 0, eventStart: 20 * DAY_MS, remindersEnabled: true };
		const curve = PACE_GRID.map((p) => (p <= 0.8 ? 0.9 : 0.4));
		const aligned = alignedCurve(curve, source, target);
		expect(valueAt(aligned, 0.9)).toBeCloseTo(0.9);
		expect(valueAt(aligned, 0.92)).toBeCloseTo(0.4);
	});
	it("uses actual reminder timestamps when recorded", () => {
		const source = {
			...TIMELINE,
			remindersEnabled: true,
			reminderTimes: { twoDays: OPENS + 9 * DAY_MS },
		};
		const target = { ...TIMELINE, remindersEnabled: true };
		const curve = PACE_GRID.map((p) => (p <= 0.9 ? 0.9 : 0.4));
		const aligned = alignedCurve(curve, source, target);
		expect(valueAt(aligned, 0.8)).toBeCloseTo(0.9);
		expect(valueAt(aligned, 0.85)).toBeCloseTo(0.4);
	});
});
