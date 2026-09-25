"use client";

import { barY, defineChart, lineY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { formatNokFromOre, ORE_PER_KRONE, type SemesterRevenue } from "@workspace/shared/products";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { useMemo } from "react";
import { dimmed, SERIES_COLORS } from "./series-colors";

const kronerFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const MUTED = "var(--muted-foreground)";
const DIMMED_LABEL_OPACITY = 0.6;

const X_AXIS_LABEL = "Semester";
const Y_AXIS_LABEL = "Inntekt eks. mva.";

const SERIES = {
	event: { label: "Bedriftspresentasjoner", color: SERIES_COLORS.event },
	external_event: { label: "Eksterne", color: SERIES_COLORS.external_event },
	job_listing: { label: "Stillingsannonser", color: SERIES_COLORS.job_listing },
	average: { label: "Snitt siste 4", color: MUTED },
};

type Layer = { key: string; series: string; kroner: number; color: string };

const LEGEND = [
	SERIES.event,
	SERIES.external_event,
	SERIES.job_listing,
	{ ...SERIES.average, dashed: true },
];

function layers(semester: SemesterRevenue): Layer[] {
	const { bySeries, key } = semester;
	return [
		{ ...SERIES.event, ore: bySeries.event + bySeries.other },
		{ ...SERIES.external_event, ore: bySeries.external_event },
		{ ...SERIES.job_listing, ore: bySeries.job_listing },
	].map(({ label, color, ore }) => ({
		key,
		series: label,
		kroner: ore / ORE_PER_KRONE,
		color,
	}));
}

export function RevenueChart({
	semesters,
	selectedKey,
	onSelect,
}: Readonly<{
	semesters: readonly SemesterRevenue[];
	selectedKey: string | null;
	onSelect: (key: string) => void;
}>) {
	const definition = useMemo(() => {
		const isDimmed = (key: string) => selectedKey !== null && key !== selectedKey;
		const labels = new Map(semesters.map((semester) => [semester.key, semester.label]));
		const averages = semesters.flatMap((semester) =>
			semester.rollingAverageOre === null
				? []
				: [
						{
							key: semester.key,
							series: SERIES.average.label,
							kroner: semester.rollingAverageOre / ORE_PER_KRONE,
						},
					],
		);

		return defineChart({
			marks: [
				barY(semesters.flatMap(layers), {
					x: "key",
					y: "kroner",
					inset: 6,
					fill: (layer) => (isDimmed(layer.key) ? dimmed(layer.color) : layer.color),
				}),
				lineY(averages, {
					x: "key",
					y: "kroner",
					stroke: MUTED,
					strokeWidth: 1.5,
					strokeDasharray: "5 4",
				}),
			],
			scales: {
				x: {
					scale: () =>
						scaleBand<string>()
							.domain(semesters.map((semester) => semester.key))
							.padding(0.2),
					axis: {
						label: X_AXIS_LABEL,
						ticks: { size: 0, format: (key: string) => labels.get(key) ?? key },
						tickLabels: {
							thin: false,
							fontSize: 11,
							fontWeight: ({ value }) => (isDimmed(value) ? 400 : 600),
							opacity: ({ value }) => (isDimmed(value) ? DIMMED_LABEL_OPACITY : 1),
						},
					},
				},
				y: {
					scale: scaleLinear,
					nice: true,
					grid: true,
					axis: {
						label: Y_AXIS_LABEL,
						ticks: { format: (value: number) => kronerFormat.format(value) },
					},
				},
			},
			tooltip: {
				use: tooltip,
				items: [
					{
						channel: "x",
						label: X_AXIS_LABEL,
						text: (point) => labels.get(point.datum.key) ?? point.datum.key,
					},
					{ field: "series", label: "Produkt" },
					{
						channel: "y",
						label: Y_AXIS_LABEL,
						text: (point) => formatNokFromOre(point.datum.kroner * ORE_PER_KRONE),
					},
				],
			},
		});
	}, [semesters, selectedKey]);

	return (
		<Panel title="Inntekt per semester" aside={<ChartLegend items={LEGEND} />}>
			<PanelBody className="cursor-pointer">
				<Chart
					definition={definition}
					height={300}
					initialWidth={760}
					ariaLabel="Inntekt per semester"
					ariaDescription={semesters
						.map((semester) => `${semester.label}: ${formatNokFromOre(semester.revenueOre)}`)
						.join(", ")}
					onSelect={(point) => {
						const layer = point?.datum as Layer | undefined;
						if (layer?.key) onSelect(layer.key);
					}}
				/>
			</PanelBody>
		</Panel>
	);
}
