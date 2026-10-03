import { DAY_MS, HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { median } from "d3-array";
import { scaleLinear } from "d3-scale";
import {
	REMINDER_KINDS,
	REMINDER_LEAD_TIMES,
	type ReminderKind,
} from "../events/reminders/schedule";
import type { AlertRule, RegistrationChange } from "./schema";

export const PACE_STEPS = 100;
export const PACE_GRID = [
	0,
	0.0001,
	0.0002,
	0.0005,
	0.001,
	0.002,
	0.005,
	...Array.from({ length: PACE_STEPS }, (_, step) => (step + 1) / PACE_STEPS),
];
export const WAVE_RULE = { windowMs: HOUR_MS, minCount: 5, minShare: 0.1 };
export const BEHIND_RULE = { maxProjectedFill: 0.5, withinMs: 3 * DAY_MS };
export const NO_REGISTRATIONS_AFTER_MS = DAY_MS;
export const AHEAD_RATIO = 1.15;
export const SIMILAR_CAPACITY_BAND = 0.5;
export const BASELINE_SIZE = 12;
export const COMPANY_BASELINE = { size: 6, poolWeight: 2 };
export const ALERT_ACTIVITY = {
	unregisterWave: { change: "unregistered", bucketMs: 10 * MINUTE_MS, buckets: 12 },
	behindPace: { change: "registered", bucketMs: DAY_MS, buckets: 14 },
	noRegistrations: { change: "registered", bucketMs: DAY_MS, buckets: 14 },
} as const satisfies Record<
	AlertRule,
	{ change: RegistrationChange; bucketMs: number; buckets: number }
>;

export type Timeline = { registrationOpens: number; eventStart: number };
export type ForecastTimeline = Timeline & {
	remindersEnabled?: boolean;
	reminderTimes?: Partial<Record<ReminderKind, number>>;
};

// Align observed changes around the reminder windows, rather than assuming that
// 80% through a 14-day registration period is the same as 80% through a 7-day one.
export function alignedCurve(curve: number[], source: ForecastTimeline, target: ForecastTimeline) {
	const anchors = [{ source: 0, target: 0 }];
	if (source.remindersEnabled && target.remindersEnabled) {
		for (const kind of REMINDER_KINDS) {
			const sourceAt =
				source.reminderTimes?.[kind] ?? source.eventStart - REMINDER_LEAD_TIMES[kind];
			const targetAt =
				target.reminderTimes?.[kind] ?? target.eventStart - REMINDER_LEAD_TIMES[kind];
			const from = progressOf(source, sourceAt);
			const to = progressOf(target, targetAt);
			const previous = anchors[anchors.length - 1]!;
			if (from > previous.source && from < 1 && to > previous.target && to < 1)
				anchors.push({ source: from, target: to });
		}
	}
	anchors.push({ source: 1, target: 1 });
	const sourceProgress = scaleLinear(
		anchors.map((a) => a.target),
		anchors.map((a) => a.source),
	).clamp(true);
	return PACE_GRID.map((progress) => valueAt(curve, sourceProgress(progress)));
}

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

export function seatCurve(
	{ registrationOpens, eventStart }: Timeline,
	limit: number,
	entries: readonly LogEntry[],
) {
	return PACE_GRID.map((progress) => {
		const cutoff = registrationOpens + (eventStart - registrationOpens) * progress;
		const seats = seatDelta(entries.filter(({ at }) => at <= cutoff));
		return Math.min(1, Math.max(0, seats / limit));
	});
}

export function medianCurve(curves: readonly (readonly number[])[]) {
	if (curves.length === 0) return null;
	return PACE_GRID.map((_, step) => median(curves, (curve) => curve[step] ?? 0) as number);
}

export function valueAt(curve: readonly number[], progress: number) {
	return scaleLinear(PACE_GRID, curve).clamp(true)(progress);
}

export function isSimilarCapacity(limit: number, otherLimit: number) {
	return Math.abs(otherLimit - limit) <= limit * SIMILAR_CAPACITY_BAND;
}

export function projectFill(
	currentFill: number,
	progress: number,
	baseline: number[] | null,
	targetProgress = 1,
) {
	if (!baseline || progress <= 0 || targetProgress <= progress) return currentFill;
	const change = valueAt(baseline, targetProgress) - valueAt(baseline, progress);
	return Math.min(1, Math.max(0, currentFill + change));
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
	filledAt,
	unregistrations,
	baseline,
}: {
	now: number;
	timeline: Timeline;
	limit: number;
	registrationTimes: readonly number[];
	filledAt?: number | null;
	unregistrations: number;
	baseline: number[] | null;
}): EngagementStatus {
	const registered = registrationTimes.length;
	if (now < timeline.registrationOpens) {
		return { kind: "notOpen", opensAt: timeline.registrationOpens };
	}
	if (isWave(unregistrations, registered)) return { kind: "wave", count: unregistrations };
	if (registered >= limit) {
		const fullAt = filledAt ?? ([...registrationTimes].sort((a, b) => a - b)[limit - 1] as number);
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
		baseline &&
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
