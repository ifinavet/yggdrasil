"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { type ReactNode, useRef, useState } from "react";
import { PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { useStableQuery } from "@/hooks/use-stable-query";
import { AudiencePanel } from "./audience-panel";
import {
	type CompanyComparison,
	type CompanyDetail,
	type CompanyHistory,
	type CompanyRow,
	DEMAND_NOTE,
	fillShare,
	formatMetric,
	METRICS,
	type MetricKey,
	PAST_PACE_NOTE,
	rankLabel,
	type SemesterOption,
	semesterLabel,
	TREND_METRICS,
} from "./engagement-format";
import { PaceChart } from "./pace-chart";
import { PastTable } from "./past-view";
import { useSemesterSelect } from "./semester-select";

const NUMBER_HEAD = `${LIST_HEAD} text-right`;
const NUMBER_CELL = `${LIST_CELL} text-right tabular-nums`;

function Missing({ children }: Readonly<{ children: ReactNode }>) {
	return <span className="text-muted-foreground">{children}</span>;
}

function MetricValue({ metric, value }: Readonly<{ metric: MetricKey; value: number | null }>) {
	return formatMetric(metric, value) ?? <Missing>Ikke målt</Missing>;
}

function CompanyTable({
	companies,
	selectedId,
	onSelect,
}: Readonly<{
	companies: CompanyRow[];
	selectedId: Id<"companies"> | null;
	onSelect: (companyId: Id<"companies">) => void;
}>) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={LIST_HEAD}>Bedrift</TableHead>
					<TableHead className={NUMBER_HEAD}>Arrangementer</TableHead>
					<TableHead className={LIST_HEAD}>Påmeldte</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.demand.label}</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.attendance.label}</TableHead>
					<TableHead className={NUMBER_HEAD}>{METRICS.latePerEvent.label}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{companies.map((company) => (
					<TableRow
						key={company.companyId}
						data-state={company.companyId === selectedId ? "selected" : undefined}
						className="relative"
					>
						<TableCell className={LIST_CELL}>
							<div className="flex min-w-0 items-center gap-2.5">
								<CompanyLogo name={company.name} url={company.logoUrl} />
								<button
									type="button"
									onClick={() => onSelect(company.companyId)}
									className="truncate text-left font-medium after:absolute after:inset-0"
								>
									{company.name}
								</button>
							</div>
						</TableCell>
						<TableCell className={NUMBER_CELL}>{company.events}</TableCell>
						<TableCell className={LIST_CELL}>
							<div className="whitespace-nowrap tabular-nums">
								{company.registered} / {company.seats}
								<div className="mt-1.5 w-24">
									<ShareBar
										share={fillShare(company.registered, company.seats)}
										color={PRIMARY_SERIES_COLOR}
									/>
								</div>
							</div>
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="demand" value={company.demand} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="attendance" value={company.attendance} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric="latePerEvent" value={company.latePerEvent} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function Companies({
	companies,
	selectedId,
	onSelect,
}: Readonly<{
	companies: CompanyRow[] | undefined;
	selectedId: Id<"companies"> | null;
	onSelect: (companyId: Id<"companies">) => void;
}>) {
	if (!companies) {
		return (
			<PanelBody>
				<Skeleton className="h-48 w-full" />
			</PanelBody>
		);
	}
	if (!companies.length) {
		return (
			<PanelBody>
				<PanelNote>Ingen arrangementer med påmelding dette semesteret.</PanelNote>
			</PanelBody>
		);
	}
	return (
		<>
			<CompanyTable companies={companies} selectedId={selectedId} onSelect={onSelect} />
			<PanelBody>
				<PanelNote>{DEMAND_NOTE}</PanelNote>
			</PanelBody>
		</>
	);
}

function ComparisonTable({ comparison }: Readonly<{ comparison: CompanyComparison[] }>) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={LIST_HEAD}>Måltall</TableHead>
					<TableHead className={NUMBER_HEAD}>Bedriften</TableHead>
					<TableHead className={NUMBER_HEAD}>Snitt alle bedrifter</TableHead>
					<TableHead className={NUMBER_HEAD}>Plassering</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{comparison.map((metric) => (
					<TableRow key={metric.key}>
						<TableCell className={LIST_CELL}>{METRICS[metric.key].label}</TableCell>
						<TableCell className={`${NUMBER_CELL} font-medium`}>
							<MetricValue metric={metric.key} value={metric.value} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							<MetricValue metric={metric.key} value={metric.average} />
						</TableCell>
						<TableCell className={NUMBER_CELL}>{rankLabel(metric)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function TrendTable({ history }: Readonly<{ history: CompanyHistory }>) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={LIST_HEAD}>Semester</TableHead>
					{TREND_METRICS.map((metric) => (
						<TableHead key={metric} className={NUMBER_HEAD}>
							{METRICS[metric].label}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{history.map((semester) => (
					<TableRow key={semesterLabel(semester)}>
						<TableCell className={LIST_CELL}>{semesterLabel(semester)}</TableCell>
						{TREND_METRICS.map((metric) => (
							<TableCell key={metric} className={NUMBER_CELL}>
								{semester.company === null ? (
									<Missing>Ingen arrangementer</Missing>
								) : (
									<MetricValue metric={metric} value={semester.company[metric]} />
								)}
								<span className="block text-muted-foreground text-xs">
									{`snitt ${formatMetric(metric, semester.average[metric]) ?? "ikke målt"}`}
								</span>
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function CompanyEvents({ detail, now }: Readonly<{ detail: CompanyDetail; now: number }>) {
	const [picked, setPicked] = useState<Id<"events"> | null>(null);
	const paceRef = useRef<HTMLDivElement>(null);
	const selectedId = picked && detail.events.some((event) => event._id === picked) ? picked : null;
	const openEvent = (eventId: Id<"events">) => {
		setPicked(eventId);
		paceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<>
			<Panel title="Gjennomførte arrangementer">
				{detail.events.length ? (
					<PastTable events={detail.events} selectedId={selectedId} onSelect={openEvent} />
				) : (
					<PanelBody>
						<PanelNote>Ingen gjennomførte arrangementer dette semesteret.</PanelNote>
					</PanelBody>
				)}
			</Panel>
			<div ref={paceRef} className="scroll-mt-4">
				{selectedId && <PaceChart eventId={selectedId} now={now} note={PAST_PACE_NOTE} />}
			</div>
		</>
	);
}

function CompanyAnalysis({
	companyId,
	now,
	selected,
}: Readonly<{ companyId: Id<"companies">; now: number; selected: SemesterOption }>) {
	const detail = useStableQuery(
		api.engagement.companies.detail,
		{ companyId, now, ...selected },
		`${companyId}-${selected.semester}-${selected.year}`,
	);
	const history = useStableQuery(api.engagement.companies.history, { companyId, now }, companyId);

	if (!detail) return <Skeleton className="h-72 rounded-lg" />;
	return (
		<>
			<Panel title={detail.name}>
				<ComparisonTable comparison={detail.comparison} />
			</Panel>
			<Panel title="Utvikling over semestre">
				{history ? (
					<TrendTable history={history} />
				) : (
					<PanelBody>
						<Skeleton className="h-40 w-full" />
					</PanelBody>
				)}
			</Panel>
			<AudiencePanel
				title="Hvem melder seg på"
				audience={detail.audience}
				reachLabel="Andel av bedpres-gjengerne påmeldt"
				reachNote="Hvor stor del av studentene i hvert kull som meldte seg på bedpres dette semesteret, som valgte denne bedriften."
				population={{
					label: "Alle på bedpres",
					shareOf: "av alle på bedpres",
					legend: "Andel av alle på bedpres",
				}}
			/>
			<CompanyEvents detail={detail} now={now} />
		</>
	);
}

export function CompaniesView({ now }: Readonly<{ now: number }>) {
	const { selected, select } = useSemesterSelect(now);
	const companies = useStableQuery(
		api.engagement.companies.list,
		{ now, ...selected },
		`${selected.semester}-${selected.year}`,
	);
	const [picked, setPicked] = useState<Id<"companies"> | null>(null);
	const detailRef = useRef<HTMLDivElement>(null);

	const selectedId =
		picked && companies?.some((company) => company.companyId === picked)
			? picked
			: (companies?.[0]?.companyId ?? null);
	const openCompany = (companyId: Id<"companies">) => {
		setPicked(companyId);
		detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="grid gap-4">
			<Panel title="Arrangementer per bedrift" aside={select}>
				<Companies companies={companies} selectedId={selectedId} onSelect={openCompany} />
			</Panel>
			<div ref={detailRef} className="grid scroll-mt-4 gap-4">
				{selectedId && <CompanyAnalysis companyId={selectedId} now={now} selected={selected} />}
			</div>
		</div>
	);
}
