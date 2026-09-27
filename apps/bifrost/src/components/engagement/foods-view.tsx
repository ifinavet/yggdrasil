"use client";

import { barX, defineChart, dot, ruleX, text, tickX } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { api } from "@workspace/backend/convex/api";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useMemo } from "react";
import { MUTED_SERIES_COLOR, PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { useStableQuery } from "@/hooks/use-stable-query";
import {
	DEMAND_NOTE,
	type FoodBreakdown,
	foodDemandPoints,
	foodDistribution,
	formatShare,
	METRICS,
} from "./engagement-format";
import { useSemesterSelect } from "./semester-select";

const ROW_HEIGHT = 32;
const AXIS_HEIGHT = 48;
const CHART_WIDTH = 760;
const DASHED = "5 4";

const DEMAND_SERIES = {
	event: { label: "Arrangement", color: PRIMARY_SERIES_COLOR },
	food: { label: "Snitt for maten", color: PRIMARY_SERIES_COLOR },
	all: { label: "Snitt for alle", color: MUTED_SERIES_COLOR, marker: "dashed" as const },
};

function chartHeight(rows: number) {
	return rows * ROW_HEIGHT + AXIS_HEIGHT;
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
					y: { scale: () => scaleBand().padding(0.25), axis: { ticks: { size: 0 } } },
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
	const { events, foods } = foodDemandPoints(breakdown);
	const definition = useMemo(
		() =>
			defineChart({
				marks: [
					...(breakdown.demand === null
						? []
						: [
								ruleX([breakdown.demand], {
									stroke: DEMAND_SERIES.all.color,
									strokeDasharray: DASHED,
									strokeOpacity: 1,
								}),
							]),
					dot(events, {
						x: "demand",
						y: "name",
						key: "_id",
						r: 5,
						fill: DEMAND_SERIES.event.color,
						fillOpacity: 0.35,
					}),
					tickX(foods, {
						x: "demand",
						y: "name",
						stroke: DEMAND_SERIES.food.color,
						strokeWidth: 3,
					}),
				],
				scales: {
					x: {
						scale: scaleLinear,
						nice: true,
						grid: true,
						axis: { label: METRICS.demand.label, ticks: { format: formatShare } },
					},
					y: { scale: () => scaleBand().padding(0.25), axis: { ticks: { size: 0 } } },
				},
				tooltip: {
					use: tooltip,
					items: [
						{ channel: "y", label: "Mat" },
						{ channel: "x", label: METRICS.demand.label, text: (point) => formatShare(point.x) },
					],
				},
			}),
		[breakdown.demand, events, foods],
	);

	return (
		<Chart
			definition={definition}
			height={chartHeight(foods.length)}
			initialWidth={CHART_WIDTH}
			ariaLabel={`${METRICS.demand.label} per mat`}
			ariaDescription={foods.map((food) => `${food.name}: ${formatShare(food.demand)}`).join(", ")}
		/>
	);
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
	const { selected, select } = useSemesterSelect(now);
	const breakdown = useStableQuery(
		api.engagement.companies.foods,
		{ now, ...selected },
		`${selected.semester}-${selected.year}`,
	);
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
				<Panel
					title={`${METRICS.demand.label} per mat`}
					aside={<ChartLegend items={Object.values(DEMAND_SERIES)} />}
				>
					<PanelBody className="grid gap-3">
						<DemandChart breakdown={breakdown} />
						<PanelNote>{DEMAND_NOTE}</PanelNote>
					</PanelBody>
				</Panel>
			)}
		</div>
	);
}
