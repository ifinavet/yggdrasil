"use client";

import { barY, defineChart, tickY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { ChartLegend } from "@workspace/ui/components/products/chart-legend";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { cn } from "@workspace/ui/lib/utils";
import { useMemo } from "react";
import {
	ACCENT_SERIES_COLOR,
	heatTint,
	MUTED_SERIES_COLOR,
	needsLightText,
	PRIMARY_SERIES_COLOR,
	tinted,
} from "@/components/common/chart-colors";
import {
	type Audience,
	type AudienceRow,
	cohortTints,
	formatPoints,
	formatShare,
	type ProgramRow,
} from "./engagement-format";

const DEGREE_COLORS = [PRIMARY_SERIES_COLOR, ACCENT_SERIES_COLOR, MUTED_SERIES_COLOR];
const MIN_LABELLED_SEGMENT = 0.07;
const COHORT_CODE_NOTE = "B er bachelor, M er master og Å er årsstudium, tallet er årstrinnet.";
const PREVIOUS_LABEL = "Forrige semester";

function useCohortColors(cohorts: readonly AudienceRow[]) {
	return useMemo(
		() =>
			cohortTints(cohorts).map(({ series, tint }) => ({
				color: tinted(DEGREE_COLORS[series % DEGREE_COLORS.length] as string, tint),
				lightText: needsLightText(tint / 100),
			})),
		[cohorts],
	);
}

function MixBar({
	label,
	shares,
	colors,
}: Readonly<{
	label: string;
	shares: readonly number[];
	colors: readonly { color: string; lightText: boolean }[];
}>) {
	return (
		<div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3">
			<span className="text-muted-foreground text-sm">{label}</span>
			<div className="flex h-8 overflow-hidden rounded-md bg-muted">
				{shares.map((share, index) => (
					<div
						key={colors[index]?.color}
						className={cn(
							"flex items-center justify-center border-background border-r text-[12px] tabular-nums last:border-r-0",
							colors[index]?.lightText && "text-primary-foreground",
						)}
						style={{ width: `${share * 100}%`, background: colors[index]?.color }}
					>
						{share >= MIN_LABELLED_SEGMENT && formatShare(share)}
					</div>
				))}
			</div>
		</div>
	);
}

function CohortMix({ cohorts }: Readonly<{ cohorts: readonly AudienceRow[] }>) {
	const colors = useCohortColors(cohorts);
	return (
		<div className="grid gap-2">
			<MixBar label="Påmeldte" shares={cohorts.map(({ share }) => share)} colors={colors} />
			<MixBar
				label="Alle studenter"
				shares={cohorts.map(({ populationShare }) => populationShare)}
				colors={colors}
			/>
			<div className="pt-1 sm:pl-[124px]">
				<ChartLegend
					items={cohorts.map((cohort, index) => ({
						label: cohort.label,
						color: colors[index]?.color as string,
					}))}
				/>
			</div>
		</div>
	);
}

function CohortReach({
	cohorts,
	reachLabel,
	reachNote,
}: Readonly<{ cohorts: readonly AudienceRow[]; reachLabel: string; reachNote: string }>) {
	const hasPrevious = cohorts.some(({ previousReach }) => previousReach !== null);
	const colors = useCohortColors(cohorts);
	const definition = useMemo(() => {
		const rows = cohorts.map(({ code, reach, previousReach }, index) => ({
			label: code,
			color: colors[index]?.color as string,
			reach: reach * 100,
			previous: previousReach === null ? null : previousReach * 100,
		}));
		return defineChart({
			marks: [
				barY(rows, {
					x: "label",
					y: "reach",
					fill: ({ color }) => color,
					radius: 3,
					maxThickness: 56,
				}),
				...(hasPrevious
					? [
							tickY(rows, {
								x: "label",
								y: "previous",
								stroke: MUTED_SERIES_COLOR,
								strokeWidth: 3,
								span: 0.6,
							}),
						]
					: []),
			],
			scales: {
				x: {
					scale: () =>
						scaleBand<string>()
							.domain(rows.map(({ label }) => label))
							.padding(0.25),
					axis: { ticks: { size: 0 }, tickLabels: { fontSize: 11 } },
				},
				y: {
					scale: scaleLinear().domain([0, 100]),
					grid: true,
					axis: {
						label: reachLabel,
						ticks: { format: (value: number) => formatShare(value / 100) },
					},
				},
			},
			tooltip: {
				use: tooltip,
				items: [
					{ channel: "x", label: "Årskull" },
					{
						channel: "y",
						label: reachLabel,
						text: (point) => formatShare(point.datum.reach / 100),
					},
				],
			},
		});
	}, [cohorts, colors, hasPrevious, reachLabel]);

	return (
		<div className="grid content-start gap-3">
			<Chart
				definition={definition}
				height={240}
				initialWidth={420}
				ariaLabel={reachLabel}
				ariaDescription={cohorts
					.map(({ label, reach }) => `${label}: ${formatShare(reach)}`)
					.join(", ")}
			/>
			{hasPrevious && (
				<ChartLegend
					items={[{ label: PREVIOUS_LABEL, color: MUTED_SERIES_COLOR, marker: "line" }]}
				/>
			)}
			<PanelNote>{`${reachNote} ${COHORT_CODE_NOTE}`}</PanelNote>
		</div>
	);
}

function Dumbbell({ row, scale }: Readonly<{ row: ProgramRow; scale: number }>) {
	const [low, high] = [row.share, row.populationShare].sort((a, b) => a - b) as [number, number];
	const overRepresented = row.share >= row.populationShare;
	const position = (share: number) => `${(share / scale) * 100}%`;
	return (
		<div
			className="relative h-4"
			title={`${formatShare(row.share)} av påmeldte, ${formatShare(row.populationShare)} av studentene`}
		>
			<div className="absolute inset-x-0 top-1/2 h-px bg-border" />
			<div
				className="absolute top-1/2 h-0.5 -translate-y-1/2"
				style={{
					left: position(low),
					width: `calc(${position(high)} - ${position(low)})`,
					background: overRepresented ? PRIMARY_SERIES_COLOR : MUTED_SERIES_COLOR,
				}}
			/>
			<span
				className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background"
				style={{ left: position(row.populationShare), borderColor: MUTED_SERIES_COLOR }}
			/>
			<span
				className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
				style={{ left: position(row.share), background: PRIMARY_SERIES_COLOR }}
			/>
		</div>
	);
}

function ProgramMatrix({
	programs,
	cohorts,
}: Readonly<{ programs: readonly ProgramRow[]; cohorts: readonly AudienceRow[] }>) {
	const hottest = Math.max(1, ...programs.flatMap(({ byCohort }) => byCohort));
	const scale = Math.max(
		Number.EPSILON,
		...programs.flatMap(({ share, populationShare }) => [share, populationShare]),
	);
	const showChange = programs.some(({ change }) => change !== null);
	return (
		<div className="grid content-start gap-3 overflow-x-auto">
			<table className="w-full border-separate border-spacing-x-1 border-spacing-y-1 text-[12px]">
				<thead className="text-muted-foreground">
					<tr>
						<th className="text-left font-medium">Studieprogram</th>
						{cohorts.map(({ label, code }) => (
							<th key={label} className="w-10 font-medium" title={label}>
								{code}
							</th>
						))}
						<th className="min-w-32 px-2 text-left font-medium">Representasjon</th>
						{showChange && <th className="text-right font-medium">Endring</th>}
					</tr>
				</thead>
				<tbody>
					{programs.map((row) => (
						<tr key={row.label}>
							<td className="py-1 pr-2 text-sm">{row.label}</td>
							{row.byCohort.map((count, index) => {
								const heat = count / hottest;
								return (
									<td
										key={cohorts[index]?.label}
										title={`${row.label}, ${cohorts[index]?.label}: ${count} påmeldinger`}
										className={cn(
											"h-8 rounded-sm text-center tabular-nums",
											count > 0 && needsLightText(heat) && "text-primary-foreground",
										)}
										style={{
											background: count > 0 ? heatTint(PRIMARY_SERIES_COLOR, heat) : "var(--muted)",
										}}
									>
										{count > 0 ? count : null}
									</td>
								);
							})}
							<td className="px-2">
								<Dumbbell row={row} scale={scale} />
							</td>
							{showChange && (
								<td className="text-right tabular-nums">
									{row.change === null ? null : formatPoints(row.change)}
								</td>
							)}
						</tr>
					))}
				</tbody>
			</table>
			<ChartLegend
				items={[
					{ label: "Andel av påmeldte", color: PRIMARY_SERIES_COLOR, marker: "dot" },
					{ label: "Andel av alle studenter", color: MUTED_SERIES_COLOR, marker: "ring" },
				]}
			/>
			<PanelNote>
				Rutene viser antall påmeldinger per kull. Ligger den fylte prikken til høyre for ringen,
				melder programmet seg på oftere enn størrelsen tilsier.
			</PanelNote>
		</div>
	);
}

export function AudiencePanel({
	title,
	audience,
	reachLabel,
	reachNote,
	note,
	className,
}: Readonly<{
	title: string;
	audience: Audience;
	reachLabel: string;
	reachNote: string;
	note?: string;
	className?: string;
}>) {
	return (
		<Panel
			className={className}
			title={title}
			aside={
				<PanelNote>{`${audience.total} påmeldinger fra ${audience.reached} studenter`}</PanelNote>
			}
		>
			<PanelBody className="grid gap-6">
				{audience.total === 0 ? (
					<PanelNote>Ingen påmeldte ennå.</PanelNote>
				) : (
					<>
						<CohortMix cohorts={audience.cohorts} />
						<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
							<CohortReach
								cohorts={audience.cohorts}
								reachLabel={reachLabel}
								reachNote={reachNote}
							/>
							<ProgramMatrix programs={audience.programs} cohorts={audience.cohorts} />
						</div>
					</>
				)}
				{note && <PanelNote>{note}</PanelNote>}
			</PanelBody>
		</Panel>
	);
}
