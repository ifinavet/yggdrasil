"use client";

import { barX, defineChart, ruleX, text } from "@tanstack/charts";
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
	DEMAND_NOTE,
	FOOD_DEMAND_NOTE,
	type FoodBreakdown,
	type FoodEvent,
	foodBreakdown,
	foodDemandBars,
	foodDistribution,
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
const AVERAGE = { label: "Snitt for alle", color: MUTED_SERIES_COLOR, marker: "dashed" as const };

function chartHeight(rows: number) {
	return rows * ROW_HEIGHT + AXIS_HEIGHT;
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
					x: { scale: scaleLinear, nice: true, grid: true, axis: { label: "Arrangementer" } },
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
			ariaLabel="Arrangementer per mat"
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
			ariaLabel={`${METRICS.demand.label} per mat`}
			ariaDescription={rows.map((row) => `${row.name}: ${row.label}`).join(", ")}
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
			<Panel title="Arrangementer per mat" aside={select}>
				{!breakdown && <Loading />}
				{empty && <Empty />}
				{breakdown && !empty && (
					<PanelBody>
						<DistributionChart breakdown={breakdown} />
					</PanelBody>
				)}
			</Panel>
			{breakdown && !empty && (
				<Panel title={`${METRICS.demand.label} per mat`} aside={<ChartLegend items={[AVERAGE]} />}>
					<PanelBody className="grid gap-3">
						<DemandChart breakdown={breakdown} />
						<PanelNote>{DEMAND_NOTE}</PanelNote>
						<PanelNote>{FOOD_DEMAND_NOTE}</PanelNote>
					</PanelBody>
				</Panel>
			)}
		</div>
	);
}
