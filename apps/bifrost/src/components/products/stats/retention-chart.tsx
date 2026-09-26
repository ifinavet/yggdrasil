"use client";

import { barY, defineChart, text } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { type CompanyActivity, compactSemesterLabel } from "@workspace/shared/products";
import { SEMESTER_LABEL } from "@workspace/shared/semester/labels";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { useMemo } from "react";
import { NEW_SERIES, RETURNING_NEW_LEGEND, RETURNING_SERIES } from "./series-colors";

const Y_AXIS_LABEL = "Bedrifter";

export function RetentionChart({ activity }: Readonly<{ activity: readonly CompanyActivity[] }>) {
	const definition = useMemo(() => {
		const semesters = activity.slice(1);
		const labels = new Map(
			semesters.map((semester) => [semester.key, compactSemesterLabel(semester)]),
		);
		const layers = semesters.flatMap((semester) => [
			{ key: semester.key, companies: semester.returning, ...RETURNING_SERIES },
			{ key: semester.key, companies: semester.new, ...NEW_SERIES },
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
						label: SEMESTER_LABEL,
						ticks: { size: 0, format: (key: string) => labels.get(key) ?? key },
						tickLabels: { thin: false, fontSize: 10 },
					},
				},
				y: {
					scale: scaleLinear,
					nice: true,
					grid: true,
					axis: { label: Y_AXIS_LABEL, ticks: { count: 3 } },
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
					{ channel: "y", label: Y_AXIS_LABEL, text: (point) => String(point.datum.companies) },
				],
			},
		});
	}, [activity]);

	return (
		<Panel
			title="Nye og tilbakevendende bedrifter"
			description="Hvor mange bedrifter som kjøpte noe, og hvor mange av dem som var nye. Mange som kommer tilbake er et godt tegn."
			aside={<ChartLegend items={RETURNING_NEW_LEGEND} />}
		>
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
