"use client";

import { barX, defineChart, dot, ruleX, ruleY, text } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { api } from "@workspace/backend/convex/api";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQueries } from "convex/react";
import { useMemo } from "react";
import { MUTED_SERIES_COLOR, PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import {
	countTicks,
	DEMAND_NOTE,
	FOOD_DEMAND_NOTE,
	FOOD_FEW_EVENTS,
	FOOD_OPPORTUNITY_NOTE,
	type FoodBreakdown,
	type FoodEvent,
	foodBreakdown,
	foodDemandBars,
	foodDistribution,
	foodOpportunities,
	formatShare,
	METRICS,
	type SemesterOption,
	semesterValue,
} from "./engagement-format";
import { useSemesterSelect } from "./semester-select";

const ROW_HEIGHT = 32;
const AXIS_HEIGHT = 48;
const CHART_WIDTH = 760;
const DASHED = "5 4";
const OPPORTUNITY_HEIGHT = 360;
const TITLES = {
	distribution: "Arrangementer per mat",
	demand: `${METRICS.demand.label} per mat`,
	opportunity: "Mat vi bestiller for sjelden",
};
const AVERAGE = { label: "Snitt for alle", color: MUTED_SERIES_COLOR, marker: "dashed" as const };

function chartHeight(rows: number) {
	return rows * ROW_HEIGHT + AXIS_HEIGHT;
}

function countAxis(counts: readonly number[]) {
	return tickAxis(countTicks(Math.max(0, ...counts)));
}

function tickAxis(ticks: readonly number[]) {
	return {
		scale: scaleLinear().domain([0, ticks.at(-1) ?? 1]),
		grid: true,
		axis: { label: "Arrangementer", ticks: { values: ticks } },
	};
}

function bandScale() {
	return scaleBand().padding(0.25);
}

function DistributionChart({ breakdown }: Readonly<{ breakdown: FoodBreakdown }>) {
	const rows = foodDistribution(breakdown);
	const definition = useMemo(
		() =>
			defineChart({
				marks: [
					barX(rows, { x: "events", y: "name", fill: PRIMARY_SERIES_COLOR, radius: 3 }),
					text(rows, {
						x: "events",
						y: "name",
						text: "label",
						dx: 6,
						anchor: "start",
						fontSize: 11,
					}),
				],
				scales: {
					x: countAxis(rows.map((row) => row.events)),
					y: { scale: bandScale, axis: { ticks: { size: 0 } } },
				},
				tooltip,
			}),
		[rows],
	);

	return (
		<Chart
			definition={definition}
			height={chartHeight(rows.length)}
			initialWidth={CHART_WIDTH}
			ariaLabel={TITLES.distribution}
			ariaDescription={rows.map((row) => `${row.name}: ${row.label}`).join(", ")}
		/>
	);
}

function DemandChart({ breakdown }: Readonly<{ breakdown: FoodBreakdown }>) {
	const rows = foodDemandBars(breakdown);
	const definition = useMemo(
		() =>
			defineChart({
				marks: [
					barX(rows, { x: "demand", y: "name", fill: PRIMARY_SERIES_COLOR, radius: 3 }),
					text(rows, {
						x: "demand",
						y: "name",
						text: "label",
						dx: 6,
						anchor: "start",
						fontSize: 11,
					}),
					...(breakdown.demand === null
						? []
						: [
								ruleX([breakdown.demand], {
									stroke: AVERAGE.color,
									strokeDasharray: DASHED,
									strokeOpacity: 1,
								}),
							]),
				],
				scales: {
					x: {
						scale: scaleLinear,
						nice: true,
						grid: true,
						axis: { label: METRICS.demand.label, ticks: { format: formatShare } },
					},
					y: { scale: bandScale, axis: { ticks: { size: 0 } } },
				},
				tooltip: {
					use: tooltip,
					items: [
						{ channel: "y", label: "Mat" },
						{ channel: "x", label: METRICS.demand.label, text: (point) => formatShare(point.x) },
					],
				},
			}),
		[breakdown.demand, rows],
	);

	return (
		<Chart
			definition={definition}
			height={chartHeight(rows.length)}
			initialWidth={CHART_WIDTH}
			ariaLabel={TITLES.demand}
			ariaDescription={rows.map((row) => `${row.name}: ${row.label}`).join(", ")}
		/>
	);
}

function OpportunityChart({ breakdown }: Readonly<{ breakdown: FoodBreakdown }>) {
	const { points, ticks, demandAxis } = useMemo(() => foodOpportunities(breakdown), [breakdown]);
	const definition = useMemo(
		() =>
			defineChart({
				marks: [
					...(breakdown.demand === null
						? []
						: [
								ruleY([breakdown.demand], {
									stroke: AVERAGE.color,
									strokeDasharray: DASHED,
									strokeOpacity: 1,
								}),
							]),
					dot(points, { x: "events", y: "demand", r: 4, fill: PRIMARY_SERIES_COLOR }),
					decorative(
						text(
							points.filter((point) => point.labelled),
							{
								x: "events",
								y: "demand",
								text: "name",
								dx: (point) => point.dx,
								anchor: (point) => point.anchor,
								fontSize: 11,
							},
						),
					),
				],
				scales: {
					x: tickAxis(ticks),
					y: {
						scale: scaleLinear().domain(demandAxis),
						grid: true,
						axis: { label: METRICS.demand.label, ticks: { format: formatShare } },
					},
				},
				tooltip: {
					use: tooltip,
					items: [
						{ field: "name", label: "Mat" },
						{ channel: "x", label: "Arrangementer" },
						{ channel: "y", label: METRICS.demand.label, text: (point) => formatShare(point.y) },
					],
				},
			}),
		[breakdown.demand, points, ticks, demandAxis],
	);

	if (points.length === 0) {
		return (
			<PanelNote>Ingen mat er servert på minst {FOOD_FEW_EVENTS} arrangementer ennå.</PanelNote>
		);
	}

	return (
		<Chart
			definition={definition}
			height={OPPORTUNITY_HEIGHT}
			initialWidth={CHART_WIDTH}
			ariaLabel={TITLES.opportunity}
			ariaDescription={points
				.map((point) => `${point.name}: ${point.events} arrangementer, ${point.label}`)
				.join(", ")}
		/>
	);
}

function useFoodEvents(now: number, semesters: readonly SemesterOption[] | null) {
	const requests = useMemo(
		() =>
			Object.fromEntries(
				(semesters ?? []).map((semester) => [
					semesterValue(semester),
					{ query: api.engagement.companies.foods, args: { now, ...semester } },
				]),
			),
		[now, semesters],
	);
	const results = useQueries(requests);
	if (!semesters) return undefined;
	const events: FoodEvent[] = [];
	for (const semester of semesters) {
		const result = results[semesterValue(semester)];
		if (result instanceof Error) throw result;
		if (result === undefined) return undefined;
		events.push(...(result as FoodEvent[]));
	}
	return events;
}

function Loading() {
	return (
		<PanelBody>
			<Skeleton className="h-48 w-full" />
		</PanelBody>
	);
}

function Empty() {
	return (
		<PanelBody>
			<PanelNote>Ingen arrangementer med påmelding dette semesteret.</PanelNote>
		</PanelBody>
	);
}

export function FoodsView({ now }: Readonly<{ now: number }>) {
	const { selected, select, all, options } = useSemesterSelect(now, { withAll: true });
	const semesters = useMemo(() => (all ? options : [selected]), [all, options, selected]);
	const events = useFoodEvents(now, semesters);
	const breakdown = events ? foodBreakdown(events) : undefined;
	const empty = breakdown?.foods.length === 0;

	return (
		<div className="grid gap-6">
			<Panel title={TITLES.distribution} aside={select}>
				{!breakdown && <Loading />}
				{empty && <Empty />}
				{breakdown && !empty && (
					<PanelBody>
						<DistributionChart breakdown={breakdown} />
					</PanelBody>
				)}
			</Panel>
			{breakdown && !empty && (
				<Panel title={TITLES.demand} aside={<ChartLegend items={[AVERAGE]} />}>
					<PanelBody className="grid gap-3">
						<DemandChart breakdown={breakdown} />
						<PanelNote>{DEMAND_NOTE}</PanelNote>
						<PanelNote>{FOOD_DEMAND_NOTE}</PanelNote>
					</PanelBody>
				</Panel>
			)}
			{breakdown && !empty && (
				<Panel title={TITLES.opportunity} aside={<ChartLegend items={[AVERAGE]} />}>
					<PanelBody className="grid gap-3">
						<OpportunityChart breakdown={breakdown} />
						<PanelNote>{FOOD_OPPORTUNITY_NOTE}</PanelNote>
					</PanelBody>
				</Panel>
			)}
		</div>
	);
}
