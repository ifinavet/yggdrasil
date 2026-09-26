"use client";

import { barY, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import {
	compactSemesterLabel,
	formatNokFromOre,
	formatPercent,
	type SemesterRevenueSources,
	semesterLabel,
	TOP_COMPANIES,
} from "@workspace/shared/products";
import { SEMESTER_LABEL } from "@workspace/shared/semester/labels";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useMemo } from "react";
import { STATS_CELL, STATS_HEAD } from "@/components/common/table-classes";
import { REVENUE_AXIS_LABEL } from "./revenue-chart";
import { NEW_SERIES, RETURNING_NEW_LEGEND, RETURNING_SERIES } from "./series-colors";

export function NewRevenueChart({
	sources,
}: Readonly<{ sources: readonly SemesterRevenueSources[] }>) {
	const definition = useMemo(() => {
		const labels = new Map(
			sources.map((semester) => [semester.key, compactSemesterLabel(semester)]),
		);
		const layers = sources.flatMap((semester) => [
			{ key: semester.key, ore: semester.returningOre, ...RETURNING_SERIES },
			{ key: semester.key, ore: semester.newOre, ...NEW_SERIES },
		]);

		return defineChart({
			marks: [barY(layers, { x: "key", y: "ore", inset: 4, fill: (layer) => layer.color })],
			scales: {
				x: {
					scale: () =>
						scaleBand<string>()
							.domain(sources.map((semester) => semester.key))
							.padding(0.22),
					axis: {
						label: SEMESTER_LABEL,
						ticks: { size: 0, format: (key: string) => labels.get(key) ?? key },
						tickLabels: { thin: false, fontSize: 10 },
					},
				},
				y: {
					scale: scaleLinear,
					nice: true,
					grid: true,
					axis: {
						label: REVENUE_AXIS_LABEL,
						ticks: { count: 3, format: (ore: number) => formatNokFromOre(ore) },
					},
				},
			},
			tooltip: {
				use: tooltip,
				items: [
					{
						channel: "x",
						label: SEMESTER_LABEL,
						text: (point) => labels.get(point.datum.key) ?? point.datum.key,
					},
					{ field: "label", label: "Type" },
					{
						channel: "y",
						label: REVENUE_AXIS_LABEL,
						text: (point) => formatNokFromOre(point.datum.ore),
					},
				],
			},
		});
	}, [sources]);

	return (
		<Panel
			title="Inntekt fra nye og tilbakevendende"
			description="Hvor mye av inntekten som kommer fra nye bedrifter, og hvor mye som kommer fra bedrifter som har kjøpt før."
			aside={<ChartLegend items={RETURNING_NEW_LEGEND} />}
		>
			<PanelBody>
				<Chart
					definition={definition}
					height={190}
					initialWidth={520}
					ariaLabel="Inntekt fra nye og tilbakevendende bedrifter per semester"
				/>
			</PanelBody>
		</Panel>
	);
}

export function RevenueConcentration({
	sources,
}: Readonly<{ sources: readonly SemesterRevenueSources[] }>) {
	const rows = [...sources].reverse().filter((semester) => semester.totalOre > 0);
	return (
		<Panel
			title="Avhengighet av de største"
			description="Hvor stor del av inntekten som kommer fra de fem største bedriftene. Jo høyere andel, jo mer merker vi det hvis én av dem slutter å kjøpe."
			aside={<PanelNote>andel av inntekten fra topp {TOP_COMPANIES}</PanelNote>}
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className={STATS_HEAD}>Semester</TableHead>
						<TableHead className={`${STATS_HEAD} text-right`}>Topp {TOP_COMPANIES}</TableHead>
						<TableHead className={`${STATS_HEAD} text-right`}>Totalt</TableHead>
						<TableHead className={`${STATS_HEAD} text-right`}>Andel</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((semester) => (
						<TableRow key={semester.key}>
							<TableCell className={STATS_CELL}>{semesterLabel(semester)}</TableCell>
							<TableCell className={`${STATS_CELL} text-right tabular-nums`}>
								{formatNokFromOre(semester.topOre)}
							</TableCell>
							<TableCell className={`${STATS_CELL} text-right tabular-nums`}>
								{formatNokFromOre(semester.totalOre)}
							</TableCell>
							<TableCell className={`${STATS_CELL} text-right font-semibold tabular-nums`}>
								{formatPercent((semester.topOre / semester.totalOre) * 100)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Panel>
	);
}
