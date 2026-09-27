import { TREND_METRICS, type TrendMetric } from "@workspace/shared/engagement";

("use client");

import { defineChart, dot, lineY } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { ChartLegend, type LegendItem } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import { SearchField } from "@workspace/ui/components/search-field";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { type ReactNode, useMemo, useRef, useState } from "react";
import {
	ACCENT_SERIES_COLOR,
	MUTED_SERIES_COLOR,
	PRIMARY_SERIES_COLOR,
} from "@/components/common/chart-colors";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { useStableQuery } from "@/hooks/use-stable-query";
import { AudiencePanel } from "./audience-panel";
import {
	COMPARISON_GROUPS,
	type CompanyComparison,
	type CompanyDetail,
	type CompanyHistory,
	type CompanyRow,
	comparisonMax,
	DEMAND_NOTE,
	fillShare,
	formatMetric,
	METRICS,
	type MetricKey,
	matchingCompanies,
	PAST_PACE_NOTE,
	rankLabel,
	type SemesterOption,
	type Standing,
	semesterLabel,
	trendSeries,
} from "./engagement-format";
import { PaceChart } from "./pace-chart";
import { PastTable } from "./past-view";
import { useSemesterSelect } from "./semester-select";

const NUMBER_HEAD = `${LIST_HEAD} text-right`;
const NUMBER_CELL = `${LIST_CELL} text-right tabular-nums`;

function Missing({ children }: Readonly<{ children: ReactNode }>) {
	return <span className="text-muted-foreground">{children}</span>;
}

function MetricValue({ metric, value }: Readonly<{ metric: MetricKey; value: number | null }>) {
	return formatMetric(metric, value) ?? <Missing>Ikke målt</Missing>;
}

function CompanyTable({
	companies,
	selectedId,
	onSelect,
}: Readonly<{
	companies: CompanyRow[];
	selectedId: Id<"companies"> | null;
	onSelect: (companyId: Id<"companies">) => void;
}>) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={LIST_HEAD}>Bedrift</TableHead>
					<TableHead className={NUMBER_HEAD}>Arrangementer</TableHead>
					<TableHead className={LIST_HEAD}>Påmeldte</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.demand.label}</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.attendance.label}</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.latePerEvent.label}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{companies.map((company) => (
					<TableRow
						key={company.companyId}
						data-state={company.companyId === selectedId ? "selected" : undefined}
						className="relative"
					>
						<TableCell className={LIST_CELL}>
							<div className="flex min-w-0 items-center gap-2.5">
								<CompanyLogo name={company.name} url={company.logoUrl} />
								<button
									type="button"
									onClick={() => onSelect(company.companyId)}
									className="truncate text-left font-medium after:absolute after:inset-0"
								>
									{company.name}
								</button>
							</div>
						</TableCell>
						<TableCell className={NUMBER_CELL}>{company.events}</TableCell>
						<TableCell className={LIST_CELL}>
							<div className="whitespace-nowrap tabular-nums">
								{company.registered} / {company.seats}
								<div className="mt-1.5 w-24">
									<ShareBar
										share={fillShare(company.registered, company.seats)}
										color={PRIMARY_SERIES_COLOR}
									/>
								</div>
							</div>
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="demand" value={company.demand} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="attendance" value={company.attendance} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="latePerEvent" value={company.latePerEvent} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function Companies({
	companies,
	searching,
	selectedId,
	onSelect,
}: Readonly<{
	companies: CompanyRow[] | undefined;
	searching: boolean;
	selectedId: Id<"companies"> | null;
	onSelect: (companyId: Id<"companies">) => void;
}>) {
	if (!companies) {
		return (
			<PanelBody>
				<Skeleton className="h-48 w-full" />
			</PanelBody>
		);
	}
	if (!companies.length) {
		return (
			<PanelBody>
				<PanelNote>
					{searching
						? "Ingen bedrifter matcher søket."
						: "Ingen arrangementer med påmelding dette semesteret."}
				</PanelNote>
			</PanelBody>
		);
	}
	return (
		<>
			<CompanyTable companies={companies} selectedId={selectedId} onSelect={onSelect} />
			<PanelBody>
				<PanelNote>{DEMAND_NOTE}</PanelNote>
			</PanelBody>
		</>
	);
}

const STANDING_COLORS: Record<Standing, string> = {
	better: ACCENT_SERIES_COLOR,
	worse: "var(--chart-5)",
	even: MUTED_SERIES_COLOR,
};
const AVERAGE_COLOR = "var(--foreground)";
const DASHED = "5 4";
const COMPANY_SERIES = "Bedriften";
const AVERAGE_SERIES = "Snitt alle bedrifter";

const STANDING_LEGEND: LegendItem[] = [
	{ label: "Bedre enn snittet", color: STANDING_COLORS.better },
	{ label: "Svakere enn snittet", color: STANDING_COLORS.worse },
	{ label: AVERAGE_SERIES, color: AVERAGE_COLOR, marker: "line" },
];
const TREND_LEGEND: LegendItem[] = [
	{ label: COMPANY_SERIES, color: PRIMARY_SERIES_COLOR, marker: "line" },
	{ label: AVERAGE_SERIES, color: MUTED_SERIES_COLOR, marker: "dashed" },
];

function percentOf(value: number, max: number) {
	return `${Math.min(100, (value / max) * 100)}%`;
}

function ComparisonBar({ metric }: Readonly<{ metric: CompanyComparison }>) {
	const max = comparisonMax(metric);
	return (
		<div aria-hidden className="relative h-2 rounded-full bg-muted">
			{metric.value !== null && (
				<div
					className="h-full rounded-full"
					style={{
						width: percentOf(metric.value, max),
						background: metric.standing ? STANDING_COLORS[metric.standing] : MUTED_SERIES_COLOR,
					}}
				/>
			)}
			{metric.average !== null && (
				<span
					className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full"
					style={{ left: percentOf(metric.average, max), background: AVERAGE_COLOR }}
				/>
			)}
		</div>
	);
}

function ComparisonRow({ metric }: Readonly<{ metric: CompanyComparison }>) {
	const average = formatMetric(metric.key, metric.average);
	return (
		<li className="grid gap-2.5 py-3.5 first:pt-0 last:pb-0">
			<div className="flex items-baseline justify-between gap-3">
				<span className="text-sm">{METRICS[metric.key].label}</span>
				<span className="font-semibold text-lg tabular-nums leading-none">
					<MetricValue metric={metric.key} value={metric.value} />
				</span>
			</div>
			<ComparisonBar metric={metric} />
			<div className="flex justify-between gap-3 text-muted-foreground text-xs tabular-nums">
				<span>{average ? `Snitt ${average}` : "Snitt ikke målt"}</span>
				<span>{rankLabel(metric)}</span>
			</div>
		</li>
	);
}

function ComparisonGroups({ comparison }: Readonly<{ comparison: CompanyComparison[] }>) {
	return (
		<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
			{COMPARISON_GROUPS.map((group) => (
				<Panel key={group.title} title={group.title}>
					<PanelBody>
						<ul className="divide-y">
							{group.metrics.map((key) => {
								const metric = comparison.find((item) => item.key === key);
								return metric && <ComparisonRow key={key} metric={metric} />;
							})}
						</ul>
					</PanelBody>
				</Panel>
			))}
		</div>
	);
}

function CompanyHeader({ detail }: Readonly<{ detail: CompanyDetail }>) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-2">
			<CompanyLogo name={detail.name} url={detail.logoUrl} size="lg" />
			<h3 className="min-w-0 flex-1 truncate font-semibold text-xl tracking-[-0.01em]">
				{detail.name}
			</h3>
			<ChartLegend items={STANDING_LEGEND} />
		</div>
	);
}

type TrendPoint = { index: number; value: number; semester: string; series: string };

function TrendChart({
	history,
	metric,
}: Readonly<{ history: CompanyHistory; metric: TrendMetric }>) {
	const definition = useMemo(() => {
		const labels = history.map(semesterLabel);
		const { company, average } = trendSeries(history, metric);
		const pointsOf = (points: typeof company, series: string): TrendPoint[] =>
			points.map((point) => ({ ...point, semester: labels[point.index] ?? "", series }));
		const companyPoints = pointsOf(company, COMPANY_SERIES);
		const averagePoints = pointsOf(average, AVERAGE_SERIES);
		const highest = Math.max(1, ...[...company, ...average].map(({ value }) => value));
		return defineChart({
			marks: [
				lineY(averagePoints, {
					x: "index",
					y: "value",
					stroke: MUTED_SERIES_COLOR,
					strokeWidth: 1.5,
					strokeDasharray: DASHED,
				}),
				lineY(companyPoints, {
					x: "index",
					y: "value",
					stroke: PRIMARY_SERIES_COLOR,
					strokeWidth: 2,
				}),
				dot(companyPoints, { x: "index", y: "value", r: 3.5, fill: PRIMARY_SERIES_COLOR }),
			],
			scales: {
				x: {
					scale: scaleLinear().domain([-0.3, history.length - 0.7]),
					axis: {
						ticks: {
							size: 0,
							values: history.map((_, index) => index),
							format: (index: number) => labels[index] ?? "",
						},
						tickLabels: { thin: false, fontSize: 11 },
					},
				},
				y: {
					scale: scaleLinear().domain([0, highest]),
					nice: true,
					grid: true,
					axis: { ticks: { format: (value: number) => formatMetric(metric, value) ?? "" } },
				},
			},
			tooltip: {
				use: tooltip,
				items: [
					{ field: "semester", label: "Semester" },
					{
						id: "value",
						label: METRICS[metric].label,
						text: (point) => {
							const { value, series } = point.datum as TrendPoint;
							return `${formatMetric(metric, value)} (${series.toLocaleLowerCase("nb")})`;
						},
					},
				],
			},
		});
	}, [history, metric]);

	return (
		<figure className="grid min-w-0 gap-2">
			<figcaption className="font-medium text-sm">{METRICS[metric].label}</figcaption>
			<Chart
				definition={definition}
				height={180}
				initialWidth={300}
				ariaLabel={`${METRICS[metric].label} per semester`}
				ariaDescription={`${COMPANY_SERIES} mot ${AVERAGE_SERIES.toLocaleLowerCase("nb")}`}
			/>
		</figure>
	);
}

function TrendPanel({ history }: Readonly<{ history: CompanyHistory | undefined }>) {
	return (
		<Panel title="Utvikling over semestre" aside={<ChartLegend items={TREND_LEGEND} />}>
			<PanelBody>
				{history ? (
					<div className="grid gap-6 md:grid-cols-3">
						{TREND_METRICS.map((metric) => (
							<TrendChart key={metric} history={history} metric={metric} />
						))}
					</div>
				) : (
					<Skeleton className="h-52 w-full" />
				)}
			</PanelBody>
		</Panel>
	);
}

function CompanyEvents({ detail, now }: Readonly<{ detail: CompanyDetail; now: number }>) {
	const [picked, setPicked] = useState<Id<"events"> | null>(null);
	const paceRef = useRef<HTMLDivElement>(null);
	const selectedId = picked && detail.events.some((event) => event._id === picked) ? picked : null;
	const openEvent = (eventId: Id<"events">) => {
		setPicked(eventId);
		paceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<>
			<Panel title="Gjennomførte arrangementer">
				{detail.events.length ? (
					<PastTable events={detail.events} selectedId={selectedId} onSelect={openEvent} />
				) : (
					<PanelBody>
						<PanelNote>Ingen gjennomførte arrangementer dette semesteret.</PanelNote>
					</PanelBody>
				)}
			</Panel>
			<div ref={paceRef} className="scroll-mt-4">
				{selectedId && <PaceChart eventId={selectedId} now={now} note={PAST_PACE_NOTE} />}
			</div>
		</>
	);
}

function CompanyAnalysis({
	companyId,
	now,
	selected,
}: Readonly<{ companyId: Id<"companies">; now: number; selected: SemesterOption }>) {
	const detail = useStableQuery(
		api.engagement.companies.detail,
		{ companyId, now, ...selected },
		`${companyId}-${selected.semester}-${selected.year}`,
	);
	const history = useStableQuery(api.engagement.companies.history, { companyId, now }, companyId);

	if (!detail) return <Skeleton className="h-72 rounded-lg" />;
	return (
		<>
			<CompanyHeader detail={detail} />
			<ComparisonGroups comparison={detail.comparison} />
			<TrendPanel history={history} />
			<AudiencePanel
				title="Hvem melder seg på"
				audience={detail.audience}
				reachLabel="Andel av bedpres-gjengerne påmeldt"
				reachNote="Hvor stor del av studentene i hvert kull som meldte seg på bedpres dette semesteret, som valgte denne bedriften."
				population={{
					label: "Alle på bedpres",
					shareOf: "av alle på bedpres",
					legend: "Andel av alle på bedpres",
				}}
			/>
			<CompanyEvents detail={detail} now={now} />
		</>
	);
}

export function CompaniesView({ now }: Readonly<{ now: number }>) {
	const { selected, select } = useSemesterSelect(now);
	const companies = useStableQuery(
		api.engagement.companies.list,
		{ now, ...selected },
		`${selected.semester}-${selected.year}`,
	);
	const [search, setSearch] = useState("");
	const [picked, setPicked] = useState<Id<"companies"> | null>(null);
	const detailRef = useRef<HTMLDivElement>(null);
	const shown = useMemo(
		() => companies && matchingCompanies(companies, search),
		[companies, search],
	);

	const selectedId =
		picked && shown?.some((company) => company.companyId === picked)
			? picked
			: (shown?.[0]?.companyId ?? null);
	const openCompany = (companyId: Id<"companies">) => {
		setPicked(companyId);
		detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="grid gap-4">
			<Panel
				title="Arrangementer per bedrift"
				aside={
					<div className="flex flex-wrap items-center gap-2">
						<SearchField
							value={search}
							onChange={setSearch}
							placeholder="Søk etter bedrift"
							className="sm:w-72"
						/>
						{select}
					</div>
				}
			>
				<Companies
					companies={shown}
					searching={search.trim() !== ""}
					selectedId={selectedId}
					onSelect={openCompany}
				/>
			</Panel>
			<div ref={detailRef} className="grid scroll-mt-4 gap-4">
				{selectedId && <CompanyAnalysis companyId={selectedId} now={now} selected={selected} />}
			</div>
		</div>
	);
}
