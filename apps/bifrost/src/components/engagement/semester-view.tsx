"use client";

import { defineChart, lineY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts";
import { api } from "@workspace/backend/convex/api";
import { WORKDAY_LABELS } from "@workspace/shared/time";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { heatTint, needsLightText, PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { AudiencePanel } from "./audience-panel";
import {
	formatShare,
	lateUnregistrationNote,
	type SemesterData,
	timeslotGrid,
} from "./engagement-format";

const ROW = "grid grid-cols-[minmax(0,1fr)_64px] gap-x-3 gap-y-1 border-b py-2 last:border-b-0";
const ATTENDANCE_LABEL = "Oppmøte";
const WORKDAY_COLUMNS = Object.entries(WORKDAY_LABELS).map(([weekday, label]) => ({
	weekday: Number(weekday),
	label,
}));

function CompanyDemand({ companies }: Readonly<{ companies: SemesterData["companies"] }>) {
	return (
		<Panel title="Etterspørsel per bedrift">
			<PanelBody>
				{companies.map((company) => (
					<div key={company.companyId} className={ROW}>
						<div className="flex min-w-0 items-center gap-2.5">
							<CompanyLogo name={company.name} url={company.logoUrl} />
							<span className="truncate">{company.name}</span>
						</div>
						<div className="text-right tabular-nums">{formatShare(company.demand)}</div>
						<div className="col-span-full">
							<ShareBar share={Math.min(100, company.demand * 100)} color={PRIMARY_SERIES_COLOR} />
						</div>
					</div>
				))}
				<div className="pt-3">
					<PanelNote>
						Over 100 % betyr at ventelisten viser mer interesse enn det var plass til.
					</PanelNote>
				</div>
			</PanelBody>
		</Panel>
	);
}

function Attendance({ semester }: Readonly<{ semester: SemesterData }>) {
	const { attendance } = semester;
	const definition = useMemo(() => {
		const weeks = attendance.map(({ week, rate }) => ({
			week: `uke ${week}`,
			percent: rate * 100,
		}));
		return defineChart({
			marks: [
				lineY(weeks, { x: "week", y: "percent", stroke: PRIMARY_SERIES_COLOR, strokeWidth: 2 }),
			],
			scales: {
				x: {
					scale: () =>
						scaleBand<string>()
							.domain(weeks.map(({ week }) => week))
							.padding(0.2),
					axis: { ticks: { size: 0 }, tickLabels: { fontSize: 11 } },
				},
				y: {
					scale: scaleLinear().domain([
						weeks.length ? Math.min(...weeks.map(({ percent }) => percent)) : 0,
						100,
					]),
					nice: true,
					grid: true,
					axis: {
						label: ATTENDANCE_LABEL,
						ticks: { format: (value: number) => formatShare(value / 100) },
					},
				},
			},
			tooltip: {
				use: tooltip,
				items: [
					{ channel: "x", label: "Uke" },
					{
						channel: "y",
						label: ATTENDANCE_LABEL,
						text: (point) => formatShare(point.datum.percent / 100),
					},
				],
			},
		});
	}, [attendance]);

	return (
		<Panel title={ATTENDANCE_LABEL}>
			<PanelBody className="grid gap-3">
				<Chart
					definition={definition}
					height={220}
					initialWidth={480}
					ariaLabel="Oppmøte per uke"
					ariaDescription={attendance
						.map(({ week, rate }) => `uke ${week}: ${formatShare(rate)}`)
						.join(", ")}
				/>
				<PanelNote>{lateUnregistrationNote(semester.lateUnregistrations)}</PanelNote>
			</PanelBody>
		</Panel>
	);
}

function Timeslots({ timeslots }: Readonly<{ timeslots: SemesterData["timeslots"] }>) {
	const { hours, fillAt } = timeslotGrid(timeslots);
	return (
		<Panel title="Når studentene melder seg på">
			<PanelBody className="overflow-x-auto">
				<table className="w-full border-separate border-spacing-1 text-[12px]">
					<thead>
						<tr>
							<th />
							{WORKDAY_COLUMNS.map(({ weekday, label }) => (
								<th key={weekday} className="font-medium text-muted-foreground">
									{label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{hours.map((hour) => (
							<tr key={hour}>
								<th className="pr-2 text-right font-medium text-muted-foreground tabular-nums">
									{String(hour).padStart(2, "0")}
								</th>
								{WORKDAY_COLUMNS.map(({ weekday }) => {
									const cell = fillAt(weekday, hour);
									return (
										<td
											key={weekday}
											title={
												cell
													? `${formatShare(cell.fill)} fylt, ${cell.events} arrangementer`
													: undefined
											}
											className={cn(
												"h-8 rounded-sm text-center tabular-nums",
												cell && needsLightText(cell.fill) && "text-primary-foreground",
											)}
											style={{
												background: cell
													? heatTint(PRIMARY_SERIES_COLOR, cell.fill)
													: "var(--muted)",
											}}
										>
											{cell ? formatShare(cell.fill) : null}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</PanelBody>
		</Panel>
	);
}

export function SemesterView({ now }: Readonly<{ now: number }>) {
	const semester = useQuery(api.engagement.queries.semester, { now });

	if (!semester) {
		return (
			<div className="grid gap-4 lg:grid-cols-2" aria-busy>
				<Skeleton className="h-72 rounded-lg lg:col-span-2" />
				<Skeleton className="h-72 rounded-lg" />
				<Skeleton className="h-72 rounded-lg" />
				<Skeleton className="h-72 rounded-lg" />
			</div>
		);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<AudiencePanel
				className="lg:col-span-2"
				title="Hvem drar på bedpres?"
				audience={semester.audience}
				reachLabel="Andel av kullet nådd"
				reachNote="Hvor stor del av hvert kull som har meldt seg på minst ett arrangement dette semesteret. Streken viser forrige semester."
				note="Endring er andelen av påmeldte nå mot forrige semester, i prosentpoeng."
			/>
			<CompanyDemand companies={semester.companies} />
			<Attendance semester={semester} />
			<Timeslots timeslots={semester.timeslots} />
		</div>
	);
}
