"use client";

import { barY, defineChart, text } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { type CompanyActivity, compactSemesterLabel } from "@workspace/shared/products";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { useMemo } from "react";
import { SERIES_COLORS } from "./series-colors";

const RETURNING_COLOR = SERIES_COLORS.event;
const NEW_COLOR = SERIES_COLORS.external_event;

const LEGEND = [
	{ label: "Tilbakevendende", color: RETURNING_COLOR },
	{ label: "Nye", color: NEW_COLOR },
];

export function RetentionChart({ activity }: Readonly<{ activity: readonly CompanyActivity[] }>) {
	const definition = useMemo(() => {
		const semesters = activity.slice(1);
		const labels = new Map(
			semesters.map((semester) => [semester.key, compactSemesterLabel(semester)]),
		);
		const layers = semesters.flatMap((semester) => [
			{ key: semester.key, companies: semester.returning, color: RETURNING_COLOR },
			{ key: semester.key, companies: semester.new, color: NEW_COLOR },
		]);
		const totals = semesters.map((semester) => ({
			key: semester.key,
			companies: semester.returning + semester.new,
			label: `+${semester.new}`,
		}));

		return defineChart({
			marks: [
				barY(layers, { x: "key", y: "companies", inset: 4, fill: (layer) => layer.color }),
				text(totals, {
					x: "key",
					y: "companies",
					text: "label",
					dy: -6,
					fontSize: 10.5,
					fill: "var(--muted-foreground)",
				}),
			],
			scales: {
				x: {
					scale: () =>
						scaleBand<string>()
							.domain(semesters.map((semester) => semester.key))
							.padding(0.22),
					axis: {
						ticks: { size: 0, format: (key: string) => labels.get(key) ?? key },
						tickLabels: { thin: false, fontSize: 10 },
					},
				},
				y: { scale: scaleLinear, nice: true, grid: true, axis: { ticks: { count: 3 } } },
			},
			tooltip,
		});
	}, [activity]);

	return (
		<Panel title="Nye og tilbakevendende bedrifter" aside={<ChartLegend items={LEGEND} />}>
			<PanelBody>
				<Chart
					definition={definition}
					height={190}
					initialWidth={520}
					ariaLabel="Nye og tilbakevendende bedrifter per semester"
				/>
			</PanelBody>
		</Panel>
	);
}
