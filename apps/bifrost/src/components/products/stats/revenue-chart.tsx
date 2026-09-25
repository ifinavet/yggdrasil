"use client";

import { barY, defineChart, lineY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { formatNok, ORE_PER_KRONE, type SemesterRevenue } from "@workspace/shared/products";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { useMemo } from "react";
import { dimmed, SERIES_COLORS } from "./series-colors";

const kronerFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const MUTED = "var(--muted-foreground)";
const DIMMED_LABEL_OPACITY = 0.6;

type Layer = { key: string; label: string; kroner: number; color: string };

const LEGEND = [
	{ label: "Bedriftspresentasjoner", color: SERIES_COLORS.event },
	{ label: "Eksterne", color: SERIES_COLORS.external_event },
	{ label: "Stillingsannonser", color: SERIES_COLORS.job_listing },
	{ label: "Snitt siste 4", color: MUTED, dashed: true },
];

function layers(semester: SemesterRevenue): Layer[] {
	const { bySeries, key, label } = semester;
	return [
		{ key, label, kroner: bySeries.event + bySeries.other, color: SERIES_COLORS.event },
		{ key, label, kroner: bySeries.external_event, color: SERIES_COLORS.external_event },
		{ key, label, kroner: bySeries.job_listing, color: SERIES_COLORS.job_listing },
	].map((layer) => ({ ...layer, kroner: layer.kroner / ORE_PER_KRONE }));
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
				: [{ key: semester.key, kroner: semester.rollingAverageOre / ORE_PER_KRONE }],
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
					axis: { ticks: { format: (value: number) => kronerFormat.format(value) } },
				},
			},
			tooltip,
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
						.map((semester) => `${semester.label}: ${formatNok(semester.revenueOre)}`)
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
