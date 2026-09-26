import { DAY_MS, HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import type { AlertRule, RegistrationChange } from "./schema";

export const PACE_STEPS = 20;
export const WAVE_RULE = { windowMs: HOUR_MS, minCount: 5, minShare: 0.1 };
export const BEHIND_RULE = { maxProjectedFill: 0.5, withinMs: 3 * DAY_MS };
export const NO_REGISTRATIONS_AFTER_MS = DAY_MS;
export const AHEAD_RATIO = 1.15;
export const SIMILAR_CAPACITY_BAND = 0.5;
export const BASELINE_SIZE = 12;
export const ALERT_ACTIVITY = {
	unregisterWave: { change: "unregistered", bucketMs: 10 * MINUTE_MS, buckets: 12 },
	behindPace: { change: "registered", bucketMs: DAY_MS, buckets: 14 },
	noRegistrations: { change: "registered", bucketMs: DAY_MS, buckets: 14 },
} as const satisfies Record<
	AlertRule,
	{ change: RegistrationChange; bucketMs: number; buckets: number }
>;

export type Timeline = { registrationOpens: number; eventStart: number };

export type LogEntry = {
	change: RegistrationChange;
	fromStatus?: "registered" | "pending" | "waitlist";
	at: number;
};

export type EngagementStatus =
	| { kind: "notOpen"; opensAt: number }
	| { kind: "wave"; count: number }
	| { kind: "full"; minutesToFull: number }
	| { kind: "noRegistrations" }
	| { kind: "behind" }
	| { kind: "ahead" }
	| { kind: "onPace" };

export function progressOf({ registrationOpens, eventStart }: Timeline, at: number) {
	const span = eventStart - registrationOpens;
	if (span <= 0) return 1;
	return Math.min(1, Math.max(0, (at - registrationOpens) / span));
}

export function fillCurve(
	{ registrationOpens, eventStart }: Timeline,
	limit: number,
	registrationTimes: readonly number[],
) {
	const sorted = [...registrationTimes].sort((a, b) => a - b);
	return Array.from({ length: PACE_STEPS + 1 }, (_, step) => {
		const cutoff = registrationOpens + ((eventStart - registrationOpens) * step) / PACE_STEPS;
		const count = sorted.filter((time) => time <= cutoff).length;
		return Math.min(1, count / limit);
	});
}

export function medianCurve(curves: readonly (readonly number[])[]) {
	if (curves.length === 0) return null;
	return Array.from({ length: PACE_STEPS + 1 }, (_, step) => {
		const values = curves.map((curve) => curve[step] ?? 0).sort((a, b) => a - b);
		const middle = Math.floor(values.length / 2);
		return values.length % 2
			? (values[middle] as number)
			: ((values[middle - 1] as number) + (values[middle] as number)) / 2;
	});
}

export function valueAt(curve: readonly number[], progress: number) {
	const position = progress * PACE_STEPS;
	const lower = Math.floor(position);
	const upper = Math.min(PACE_STEPS, lower + 1);
	const weight = position - lower;
	return (curve[lower] as number) * (1 - weight) + (curve[upper] as number) * weight;
}

export function isSimilarCapacity(limit: number, otherLimit: number) {
	return Math.abs(otherLimit - limit) <= limit * SIMILAR_CAPACITY_BAND;
}

export function projectFill(currentFill: number, progress: number, baseline: number[] | null) {
	if (progress <= 0) return currentFill;
	if (!baseline) return Math.min(1, currentFill / progress);
	const expectedNow = valueAt(baseline, progress);
	if (expectedNow <= 0) return currentFill;
	return Math.min(1, (currentFill * (baseline[PACE_STEPS] as number)) / expectedNow);
}

export function seatDelta(entries: readonly LogEntry[]) {
	return entries.reduce((delta, { change, fromStatus }) => {
		if (change === "registered" || change === "accepted") return delta + 1;
		if ((change === "unregistered" || change === "cleared") && fromStatus === "registered") {
			return delta - 1;
		}
		return delta;
	}, 0);
}

export function recentUnregistrations(entries: readonly LogEntry[], now: number) {
	return entries.filter(
		({ change, at }) => change === "unregistered" && at > now - WAVE_RULE.windowMs && at <= now,
	);
}

export function isWave(unregistrations: number, registered: number) {
	return (
		unregistrations >= WAVE_RULE.minCount &&
		unregistrations / (registered + unregistrations) >= WAVE_RULE.minShare
	);
}

export function classify({
	now,
	timeline,
	limit,
	registrationTimes,
	unregistrations,
	baseline,
}: {
	now: number;
	timeline: Timeline;
	limit: number;
	registrationTimes: readonly number[];
	unregistrations: number;
	baseline: number[] | null;
}): EngagementStatus {
	const registered = registrationTimes.length;
	if (now < timeline.registrationOpens) {
		return { kind: "notOpen", opensAt: timeline.registrationOpens };
	}
	if (isWave(unregistrations, registered)) return { kind: "wave", count: unregistrations };
	if (registered >= limit) {
		const fullAt = [...registrationTimes].sort((a, b) => a - b)[limit - 1] as number;
		return {
			kind: "full",
			minutesToFull: Math.max(1, Math.round((fullAt - timeline.registrationOpens) / MINUTE_MS)),
		};
	}
	if (registered === 0 && now - timeline.registrationOpens >= NO_REGISTRATIONS_AFTER_MS) {
		return { kind: "noRegistrations" };
	}
	const progress = progressOf(timeline, now);
	const currentFill = registered / limit;
	if (
		timeline.eventStart - now < BEHIND_RULE.withinMs &&
		projectFill(currentFill, progress, baseline) < BEHIND_RULE.maxProjectedFill
	) {
		return { kind: "behind" };
	}
	if (baseline && currentFill > valueAt(baseline, progress) * AHEAD_RATIO) {
		return { kind: "ahead" };
	}
	return { kind: "onPace" };
}

export function activityWindowMs(rule: AlertRule) {
	const { bucketMs, buckets } = ALERT_ACTIVITY[rule];
	return bucketMs * buckets;
}

export function activityBuckets(
	entries: readonly LogEntry[],
	rule: AlertRule,
	registrationOpens: number,
	now: number,
) {
	const { change, bucketMs } = ALERT_ACTIVITY[rule];
	const from = Math.max(now - activityWindowMs(rule), registrationOpens);
	const counts = Array.from(
		{ length: Math.max(1, Math.ceil((now - from) / bucketMs)) },
		(_, index) => ({
			start: from + index * bucketMs,
			count: 0,
		}),
	);
	for (const entry of entries) {
		const bucket = counts[Math.floor((entry.at - from) / bucketMs)];
		if (entry.change === change && entry.at <= now && bucket) bucket.count += 1;
	}
	return counts;
}
