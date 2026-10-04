"use client";

import { defineChart, lineY, ruleX, text } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useMemo } from "react";
import { ACCENT_SERIES_COLOR, MUTED_SERIES_COLOR } from "@/components/common/chart-colors";
import { useStableQuery } from "@/hooks/use-stable-query";
import { type PaceCurve, paceLabels, paceTickLabel, paceTicks } from "./engagement-format";

const Y_AXIS_LABEL = "Påmeldte";
const DASHED = "5 4";
const DOTTED = "2 4";

const SERIES = {
	actual: { label: "Påmeldte", color: "var(--pace-actual)" },
	expected: { label: "Typisk forløp", color: MUTED_SERIES_COLOR, marker: "dashed" as const },
	projected: { label: "Prognose", color: ACCENT_SERIES_COLOR, marker: "dashed" as const },
};

type Point = { progress: number; at: number; count: number };

function series(curve: PaceCurve, key: "actual" | "expected" | "projected"): Point[] {
	return curve.points.flatMap(({ progress, at, ...values }) => {
		const count = values[key];
		return count === null ? [] : [{ progress, at, count }];
	});
}

function endLabels(curve: PaceCurve) {
	return paceLabels(curve).map((label) => ({ ...label, color: SERIES[label.key].color }));
}

function legendOf(curve: PaceCurve | null | undefined) {
	return Object.entries(SERIES)
		.filter(([key]) => key !== "projected" || curve?.projected !== null)
		.map(([, item]) => item);
}

function PaceChartBody({ curve }: Readonly<{ curve: PaceCurve }>) {
	const definition = useMemo(
		() =>
			defineChart({
				marks: [
					...curve.reminders.flatMap((reminder) => [
						ruleX([reminder.progress], {
							stroke: MUTED_SERIES_COLOR,
							strokeDasharray: reminder.planned ? DASHED : undefined,
							strokeOpacity: 0.7,
						}),
						text(
							[
								{
									progress: reminder.progress,
									count: curve.limit,
									label: reminder.kind === "week" ? "7-dagersmail" : "2-dagersmail",
								},
							],
							{
								x: "progress",
								y: "count",
								text: "label",
								anchor: "end",
								dx: -5,
								dy: 12,
								fontSize: 11,
								fill: MUTED_SERIES_COLOR,
							},
						),
					]),
					lineY(series(curve, "expected"), {
						x: "progress",
						y: "count",
						stroke: SERIES.expected.color,
						strokeWidth: 1.5,
						strokeDasharray: DASHED,
					}),
					lineY(series(curve, "projected"), {
						x: "progress",
						y: "count",
						stroke: SERIES.projected.color,
						strokeWidth: 1.5,
						strokeDasharray: DOTTED,
					}),
					lineY(series(curve, "actual"), {
						x: "progress",
						y: "count",
						stroke: SERIES.actual.color,
						strokeWidth: 2.5,
					}),
					...endLabels(curve).map((label) =>
						text([label], {
							x: "progress",
							y: "count",
							text: "label",
							dx: -6,
							dy: label.dy,
							anchor: "end",
							fontSize: 11,
							fill: label.color,
						}),
					),
				],
				scales: {
					x: {
						scale: scaleLinear().domain([0, 1]),
						axis: {
							ticks: {
								size: 0,
								values: paceTicks(curve.progress),
								format: (progress: number) => paceTickLabel(curve, progress),
							},
							tickLabels: { thin: false, fontSize: 11 },
						},
					},
					y: {
						scale: scaleLinear().domain([
							0,
							Math.max(curve.limit, curve.projected ?? 0, curve.typical ?? 0),
						]),
						nice: true,
						grid: true,
						axis: { label: Y_AXIS_LABEL },
					},
				},
				tooltip: {
					use: tooltip,
					items: [
						{
							channel: "x",
							label: "Tid",
							text: (point) => {
								const start = curve.points[0]?.at ?? 0;
								const end = curve.points.at(-1)?.at ?? start;
								return formatOsloDate(
									start + Number(point.xValue) * (end - start),
									DATE_PATTERNS.shortDate,
								);
							},
						},
						{ channel: "y", label: Y_AXIS_LABEL },
					],
				},
			}),
		[curve],
	);

	return (
		<Chart
			definition={definition}
			height={280}
			initialWidth={760}
			ariaLabel={`${curve.title}, påmeldingskurve`}
			ariaDescription={endLabels(curve)
				.map((label) => label.label)
				.join(", ")}
		/>
	);
}

export function PaceChart({ eventId, now }: Readonly<{ eventId: Id<"events">; now: number }>) {
	const curve = useStableQuery(api.engagement.queries.paceCurve, { eventId, now }, eventId);

	return (
		<Panel
			className="[--pace-actual:var(--primary)] dark:[--pace-actual:color-mix(in_oklch,var(--primary),white_65%)]"
			title={
				curve ? (
					<span className="flex min-w-0 items-center gap-2.5">
						<CompanyLogo name={curve.companyName} url={curve.companyLogoUrl} />
						<span className="truncate">{`${curve.title}, påmeldingskurve`}</span>
					</span>
				) : (
					"Påmeldingskurve"
				)
			}
			aside={<ChartLegend items={legendOf(curve)} />}
		>
			<PanelBody className="grid gap-3">
				{curve ? <PaceChartBody curve={curve} /> : <Skeleton className="h-[280px] w-full" />}
			</PanelBody>
		</Panel>
	);
}
