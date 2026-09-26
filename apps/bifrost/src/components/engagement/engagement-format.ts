import type { api } from "@workspace/backend/convex/api";
import { formatPercent } from "@workspace/shared/products";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import type { BadgeVariant } from "@workspace/ui/components/badge";
import type { SparkValue } from "@workspace/ui/components/products/sparkline";
import type { FunctionReturnType } from "convex/server";

export type UpcomingData = FunctionReturnType<typeof api.engagement.queries.upcoming>;
export type UpcomingEvent = UpcomingData["events"][number];
export type EngagementAlert = UpcomingData["alerts"][number];
export type EngagementStatus = UpcomingEvent["status"];
export type SemesterData = FunctionReturnType<typeof api.engagement.queries.semester>;
export type Audience = SemesterData["audience"];
export type AudienceRow = Audience["cohorts"][number];
export type ProgramRow = Audience["programs"][number];
export type UnregisterLog = FunctionReturnType<typeof api.engagement.queries.unregisterLog>;
export type PaceCurve = NonNullable<FunctionReturnType<typeof api.engagement.queries.paceCurve>>;

export function statusBadge(status: EngagementStatus): { label: string; variant: BadgeVariant } {
	switch (status.kind) {
		case "notOpen":
			return { label: "Venter", variant: "outline" };
		case "wave":
			return { label: "Avmeldingsbølge", variant: "default" };
		case "full":
			return { label: `Fullt på ${status.minutesToFull} min`, variant: "secondary" };
		case "noRegistrations":
			return { label: "Ingen påmeldte", variant: "soft" };
		case "behind":
			return { label: "Bak tempo", variant: "soft" };
		case "ahead":
			return { label: "Foran tempo", variant: "secondary" };
		case "onPace":
			return { label: "I rute", variant: "muted" };
	}
}

export function formatDelta(delta: number) {
	if (delta > 0) return `+${delta}`;
	if (delta < 0) return `−${Math.abs(delta)}`;
	return "0";
}

export function formatShare(fraction: number) {
	return formatPercent(fraction * 100);
}

export function formatPoints(fraction: number) {
	return `${formatDelta(Math.round(fraction * 100))} pp`;
}

export function fillShare(registered: number, limit: number) {
	return limit > 0 ? Math.min(100, (registered / limit) * 100) : 0;
}

export function opensLabel(opensAt: number) {
	return `Åpner ${formatOsloDate(opensAt, DATE_PATTERNS.shortDate)}`;
}

export function defaultSelection(data: UpcomingData) {
	return data.alerts[0]?.eventId ?? data.events[0]?._id ?? null;
}

type Timeslot = SemesterData["timeslots"][number];

export function timeslotGrid(timeslots: readonly Timeslot[]) {
	const cells = new Map(timeslots.map((slot) => [`${slot.weekday}-${slot.hour}`, slot]));
	return {
		hours: [...new Set(timeslots.map((slot) => slot.hour))].sort((a, b) => a - b),
		fillAt: (weekday: number, hour: number) => cells.get(`${weekday}-${hour}`),
	};
}

export function followUpNote({ entries, topDestination, followUpMinutes }: UnregisterLog) {
	if (!topDestination) return null;
	return `${topDestination.count} av ${entries.length} meldte seg på ${topDestination.title} innen ${followUpMinutes} minutter etter avmeldingen.`;
}

function lastYearComparison(difference: number) {
	if (difference === 0) return "like mange som i fjor";
	return `${Math.abs(difference)} ${difference > 0 ? "flere" : "færre"} enn i fjor`;
}

export function lateUnregistrationNote({ current, lastYear }: SemesterData["lateUnregistrations"]) {
	return `Sene avmeldinger (under 24 t): ${current} dette semesteret, ${lastYearComparison(current - lastYear)}.`;
}

const ACTIVITY_LABELS = {
	unregisterWave: {
		caption: "Avmeldinger per 10 min",
		unit: "avmeldinger",
		pattern: DATE_PATTERNS.time,
	},
	behindPace: {
		caption: "Påmeldinger per dag",
		unit: "påmeldinger",
		pattern: DATE_PATTERNS.shortDate,
	},
	noRegistrations: {
		caption: "Påmeldinger per dag",
		unit: "påmeldinger",
		pattern: DATE_PATTERNS.shortDate,
	},
} as const satisfies Record<
	EngagementAlert["rule"],
	{ caption: string; unit: string; pattern: string }
>;

export function alertActivity({ rule, activity }: EngagementAlert) {
	const { caption, unit, pattern } = ACTIVITY_LABELS[rule];
	const values: SparkValue[] = activity.map(({ start, count }) => {
		const label = formatOsloDate(start, pattern);
		return { label: String(start), value: count, title: `${label}: ${count} ${unit}` };
	});
	return { caption, values, max: Math.max(0, ...activity.map(({ count }) => count)) };
}

const STRONGEST_COHORT_TINT = 100;
const FAINTEST_COHORT_TINT = 40;

export function cohortTints(cohorts: readonly Pick<AudienceRow, "degree">[]) {
	const degrees = [...new Set(cohorts.map(({ degree }) => degree))];
	return cohorts.map((cohort) => {
		const siblings = cohorts.filter(({ degree }) => degree === cohort.degree);
		const step = (STRONGEST_COHORT_TINT - FAINTEST_COHORT_TINT) / Math.max(1, siblings.length - 1);
		return {
			series: degrees.indexOf(cohort.degree),
			tint: STRONGEST_COHORT_TINT - siblings.indexOf(cohort) * step,
		};
	});
}
