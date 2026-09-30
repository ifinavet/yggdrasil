import type { HighlightTotals } from "@workspace/shared/feedback/report";
import { HOUR_MS } from "@workspace/shared/time";
import type { Doc, Id } from "../_generated/dataModel";
import type { AnalyticsRegistration } from "./history";

export type CompanyEvent = {
	event: Doc<"events">;
	registrations: AnalyticsRegistration[];
	filledAt?: number | null;
	lateUnregistrations?: number | null;
	feedback?: HighlightTotals | null;
	returning?: number | null;
};

export const METRICS = {
	demand: { higherIsBetter: true },
	fill: { higherIsBetter: true },
	waitlistPerEvent: { higherIsBetter: true },
	hoursToFull: { higherIsBetter: false },
	attendance: { higherIsBetter: true },
	noShow: { higherIsBetter: false },
	latePerEvent: { higherIsBetter: false },
	satisfaction: { higherIsBetter: true },
	wantToWork: { higherIsBetter: true },
	returning: { higherIsBetter: true },
} as const;

export type MetricKey = keyof typeof METRICS;
export type Metrics = Record<MetricKey, number | null>;

const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export function sumOf<T>(items: readonly T[], amountOf: (item: T) => number) {
	return items.reduce((total, item) => total + amountOf(item), 0);
}

function ratio(part: number, whole: number) {
	return whole === 0 ? null : part / whole;
}

function median(values: readonly number[]) {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
		: (sorted[middle] as number);
}

function countWith(registrations: readonly AnalyticsRegistration[], status: string) {
	return registrations.filter((registration) => registration.status === status).length;
}

export function registeredIn(events: readonly Pick<CompanyEvent, "registrations">[]) {
	return events.flatMap(({ registrations }) =>
		registrations.filter((registration) => registration.status === "registered"),
	);
}

function hoursToFullOf(companyEvent: CompanyEvent) {
	const times = registeredIn([companyEvent])
		.map((registration) => registration.registrationTime)
		.sort((a, b) => a - b);
	const { participationLimit, registrationOpens } = companyEvent.event;
	const filledAt =
		companyEvent.filledAt === undefined ? times[participationLimit - 1] : companyEvent.filledAt;
	return filledAt == null ? null : Math.max(0, filledAt - registrationOpens) / HOUR_MS;
}

function attendanceOf(events: readonly CompanyEvent[]) {
	const recorded = events.flatMap((companyEvent) => {
		const registered = registeredIn([companyEvent]);
		return registered.some((registration) => registration.attendanceStatus) ? registered : [];
	});
	const showedUp = recorded.filter(
		({ attendanceStatus }) => attendanceStatus === "confirmed" || attendanceStatus === "late",
	).length;
	const noShows = recorded.filter(({ attendanceStatus }) => attendanceStatus === "no_show").length;
	return { attendance: ratio(showedUp, recorded.length), noShow: ratio(noShows, recorded.length) };
}

function feedbackOf(events: readonly CompanyEvent[]) {
	const totals = events.flatMap(({ feedback }) => (feedback ? [feedback] : []));
	return {
		satisfaction: ratio(
			sumOf(totals, ({ ratingSum }) => ratingSum),
			sumOf(totals, ({ ratings }) => ratings),
		),
		wantToWork: ratio(
			sumOf(totals, ({ wantToWork }) => wantToWork),
			sumOf(totals, ({ employmentAnswers }) => employmentAnswers),
		),
	};
}

function returningOf(events: readonly CompanyEvent[]) {
	const measured = events.filter(({ returning }) => typeof returning === "number");
	return ratio(
		sumOf(measured, ({ returning }) => returning as number),
		sumOf(measured, ({ registrations }) => countWith(registrations, "registered")),
	);
}

export function metricsOf(events: readonly CompanyEvent[], now: number): Metrics {
	const seats = sumOf(events, ({ event }) => event.participationLimit);
	const held = events.filter(({ event }) => event.eventStart <= now);
	const logged = held.flatMap(({ lateUnregistrations }) =>
		typeof lateUnregistrations === "number" ? [lateUnregistrations] : [],
	);
	return {
		demand: ratio(
			sumOf(events, ({ registrations }) => registrations.length),
			seats,
		),
		fill: ratio(
			sumOf(events, ({ registrations }) => countWith(registrations, "registered")),
			seats,
		),
		waitlistPerEvent: ratio(
			sumOf(events, ({ registrations }) => countWith(registrations, "waitlist")),
			events.length,
		),
		hoursToFull: median(events.map(hoursToFullOf).filter((hours) => hours !== null)),
		...attendanceOf(held),
		latePerEvent: ratio(
			sumOf(logged, (count) => count),
			logged.length,
		),
		...feedbackOf(held),
		returning: returningOf(events),
	};
}

export function byCompany<T extends Pick<CompanyEvent, "event">>(events: readonly T[]) {
	const grouped = new Map<Id<"companies">, T[]>();
	for (const companyEvent of events) {
		const companyId = companyEvent.event.hostingCompany;
		grouped.set(companyId, [...(grouped.get(companyId) ?? []), companyEvent]);
	}
	return grouped;
}

export function pickMetrics<K extends MetricKey>(metrics: Metrics, keys: readonly K[]) {
	return Object.fromEntries(keys.map((key) => [key, metrics[key]])) as Pick<Metrics, K>;
}

export function averageOf(all: readonly Metrics[]) {
	return Object.fromEntries(
		METRIC_KEYS.map((key) => {
			const values = all.map((metrics) => metrics[key]).filter((value) => value !== null);
			return [key, values.length === 0 ? null : sumOf(values, (value) => value) / values.length];
		}),
	) as Metrics;
}

export type Standing = "better" | "worse" | "even";

function standingOf(key: MetricKey, value: number | null, average: number | null): Standing | null {
	if (value === null || average === null) return null;
	if (value === average) return "even";
	return value > average === METRICS[key].higherIsBetter ? "better" : "worse";
}

export function comparisonOf(company: Metrics, all: readonly Metrics[]) {
	const average = averageOf(all);
	return METRIC_KEYS.map((key) => {
		const value = company[key];
		const others = all.map((metrics) => metrics[key]).filter((other) => other !== null);
		const better = (other: number) =>
			METRICS[key].higherIsBetter ? other > (value as number) : other < (value as number);
		return {
			key,
			value,
			average: average[key],
			rank: value === null ? null : others.filter(better).length + 1,
			of: others.length,
			standing: standingOf(key, value, average[key]),
		};
	});
}
