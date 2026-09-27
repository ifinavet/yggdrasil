import type { api } from "@workspace/backend/convex/api";
import type { TrendMetric } from "@workspace/shared/engagement";
import { feedbackRatingSchema } from "@workspace/shared/feedback";
import { formatPercent } from "@workspace/shared/products";
import {
	DATE_PATTERNS,
	EVENT_SEMESTER_LABELS,
	type EventSemester,
	eventSemesterRange,
	formatOsloDate,
} from "@workspace/shared/time";
import type { BadgeVariant } from "@workspace/ui/components/badge";
import type { SparkValue } from "@workspace/ui/components/products/sparkline";
import type { FunctionReturnType } from "convex/server";
import { matchesAny } from "@/lib/search";

export type UpcomingData = FunctionReturnType<typeof api.engagement.queries.upcoming>;
export type UpcomingEvent = UpcomingData["events"][number];
export type EngagementAlert = UpcomingData["alerts"][number];
export type EngagementStatus = UpcomingEvent["status"];
export type SemesterData = FunctionReturnType<typeof api.engagement.queries.semester>;
export type Audience = SemesterData["audience"];
export type AudienceRow = Audience["cohorts"][number];
export type ProgramCohort = Audience["programCohorts"][number];
export type ProgramRow = Audience["programs"][number];
export type UnregisterLog = FunctionReturnType<typeof api.engagement.queries.unregisterLog>;
export type PaceCurve = NonNullable<FunctionReturnType<typeof api.engagement.queries.paceCurve>>;
export type PastEvent = FunctionReturnType<typeof api.engagement.queries.past>[number];
export type CompanyRow = FunctionReturnType<typeof api.engagement.companies.list>[number];
export type FoodRow = FunctionReturnType<typeof api.engagement.companies.foods>[number];
export type CompanyDetail = FunctionReturnType<typeof api.engagement.companies.detail>;
export type CompanyComparison = CompanyDetail["comparison"][number];
export type CompanyHistory = FunctionReturnType<typeof api.engagement.companies.history>;
export type MetricKey = CompanyComparison["key"];

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

export function lateUnregistrationNote({
	current,
	since,
	lastYear,
}: SemesterData["lateUnregistrations"]) {
	const period =
		since === null ? "dette semesteret" : `siden ${formatOsloDate(since, DATE_PATTERNS.shortDate)}`;
	const comparison = lastYear === null ? "" : `, ${lastYearComparison(current - lastYear)}`;
	return `Sene avmeldinger (under 24 t): ${current} ${period}${comparison}.`;
}

export function paceTicks(progress: number) {
	return [...new Set([0, progress, 1])];
}

export function paceTickLabel(curve: Pick<PaceCurve, "progress">, progress: number) {
	if (progress === 0) return "Åpnet";
	if (progress === 1) return "Start";
	return progress === curve.progress ? "I dag" : "";
}

const PACE_LABEL_ABOVE = -8;
const PACE_LABEL_BELOW = 14;
const PACE_LABEL_LINE = 13;

export function paceLabels(curve: PaceCurve) {
	const actual =
		curve.progress > 0
			? [
					{
						key: "actual" as const,
						progress: curve.progress,
						count: curve.registered,
						label: curve.progress < 1 ? `${curve.registered} nå` : `${curve.registered} påmeldt`,
					},
				]
			: [];
	const projected =
		curve.projected === null
			? []
			: [
					{
						key: "projected" as const,
						progress: 1,
						count: curve.projected,
						label: `prognose ${curve.projected}`,
					},
				];
	const typical =
		curve.typical === null
			? []
			: [
					{
						key: "expected" as const,
						progress: 1,
						count: curve.typical,
						label: `typisk ${curve.typical}`,
					},
				];
	const labels = [...actual, ...projected, ...typical];
	return labels.map((label) => {
		const below = labels.filter(
			(other) =>
				other.progress === label.progress &&
				(other.count > label.count ||
					(other.count === label.count && labels.indexOf(other) < labels.indexOf(label))),
		).length;
		return {
			...label,
			dy: below === 0 ? PACE_LABEL_ABOVE : PACE_LABEL_BELOW + PACE_LABEL_LINE * (below - 1),
		};
	});
}

export type SemesterOption = { semester: EventSemester; year: number };

export function semesterValue({ semester, year }: SemesterOption) {
	return `${year}-${semester}`;
}

export function semesterLabel({ semester, year }: SemesterOption) {
	return `${EVENT_SEMESTER_LABELS[semester]} ${year}`;
}

export function startedSemesters(semesters: readonly SemesterOption[], now: number) {
	return semesters
		.filter(({ semester, year }) => eventSemesterRange(semester, year).start <= now)
		.reverse();
}

export function attendanceRate({
	registered,
	attended,
}: Pick<PastEvent, "registered" | "attended">) {
	return attended === null || registered === 0 ? null : attended / registered;
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

const REACH_AXIS_STEPS = [5, 10, 20, 25, 50, 75, 100] as const;

export function reachAxisMax(percentages: readonly (number | null)[]) {
	const highest = Math.max(0, ...percentages.filter((value) => value !== null));
	return REACH_AXIS_STEPS.find((step) => step >= highest) ?? 100;
}

export const DEMAND_NOTE =
	"Over 100 % betyr at ventelisten viser mer interesse enn det var plass til.";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

export function formatHours(hours: number) {
	const minutes = Math.round(hours * MINUTES_PER_HOUR);
	if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
	if (Math.round(hours) < 2 * HOURS_PER_DAY) return `${Math.round(hours)} t`;
	return `${Math.round(hours / HOURS_PER_DAY)} d`;
}

function formatDecimal(value: number) {
	return value.toLocaleString("nb-NO", { maximumFractionDigits: 1 });
}

export const METRICS = {
	demand: { label: "Etterspørsel", format: formatShare },
	fill: { label: "Fylte plasser", format: formatShare },
	waitlistPerEvent: { label: "Venteliste per arrangement", format: formatDecimal },
	hoursToFull: { label: "Tid til fullt", format: formatHours },
	attendance: { label: "Oppmøte", format: formatShare },
	noShow: { label: "Uteblitt", format: formatShare },
	latePerEvent: { label: "Sene avmeldinger per arrangement", format: formatDecimal },
	satisfaction: {
		label: "Fornøydhet",
		format: formatDecimal,
		max: feedbackRatingSchema.maxValue as number,
	},
	wantToWork: { label: "Vil jobbe der", format: formatShare },
	returning: { label: "Kommer tilbake", format: formatShare },
} as const satisfies Record<
	MetricKey,
	{ label: string; format: (value: number) => string; max?: number }
>;

export type Standing = NonNullable<CompanyComparison["standing"]>;

export const COMPARISON_GROUPS = [
	{ title: "Påmelding", metrics: ["demand", "fill", "waitlistPerEvent", "hoursToFull"] },
	{ title: "Oppmøte og avmelding", metrics: ["attendance", "noShow", "latePerEvent"] },
	{ title: "Inntrykk", metrics: ["satisfaction", "wantToWork", "returning"] },
] as const satisfies { title: string; metrics: MetricKey[] }[];

const COUNT_HEADROOM = 1.25;

export function comparisonMax({ key, value, average }: CompanyComparison) {
	const metric = METRICS[key];
	if ("max" in metric) return metric.max;
	const highest = Math.max(value ?? 0, average ?? 0);
	if (metric.format === formatShare) return Math.max(1, highest);
	return highest === 0 ? 1 : highest * COUNT_HEADROOM;
}

export function trendSeries(history: CompanyHistory, key: TrendMetric) {
	const pointsOf = (read: (semester: CompanyHistory[number]) => number | null | undefined) =>
		history.flatMap((semester, index) => {
			const value = read(semester);
			return value === null || value === undefined ? [] : [{ index, value }];
		});
	return {
		company: pointsOf((semester) => semester.company?.[key]),
		average: pointsOf((semester) => semester.average[key]),
	};
}

export function matchingCompanies<T extends Pick<CompanyRow, "name">>(
	companies: readonly T[],
	search: string,
) {
	return companies.filter(({ name }) => matchesAny([name], search));
}

export function formatMetric(key: MetricKey, value: number | null) {
	return value === null ? null : METRICS[key].format(value);
}

export function rankLabel({ rank, of }: Pick<CompanyComparison, "rank" | "of">) {
	return rank === null ? null : `${rank} av ${of}`;
}

export const PAST_PACE_NOTE =
	"Viser arrangementet du klikker på i tabellen. Typisk forløp bygger på arrangementene før dette.";
