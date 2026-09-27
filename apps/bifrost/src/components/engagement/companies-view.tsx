"use client";

import { api } from "@workspace/backend/convex/api";
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
import { PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { useStableQuery } from "@/hooks/use-stable-query";
import { type CompanyStats, DEMAND_NOTE, fillShare, formatShare } from "./engagement-format";
import { useSemesterSelect } from "./semester-select";

const NUMBER_HEAD = `${LIST_HEAD} text-right`;
const NUMBER_CELL = `${LIST_CELL} text-right tabular-nums`;

function CompanyTable({ companies }: Readonly<{ companies: CompanyStats[] }>) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={LIST_HEAD}>Bedrift</TableHead>
					<TableHead className={NUMBER_HEAD}>Arrangementer</TableHead>
					<TableHead className={LIST_HEAD}>Påmeldte</TableHead>
					<TableHead className={NUMBER_HEAD}>Etterspørsel</TableHead>
					<TableHead className={NUMBER_HEAD}>Oppmøte</TableHead>
					<TableHead className={NUMBER_HEAD}>Sene avmeldinger</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{companies.map((company) => (
					<TableRow key={company.companyId}>
						<TableCell className={LIST_CELL}>
							<div className="flex min-w-0 items-center gap-2.5">
								<CompanyLogo name={company.name} url={company.logoUrl} />
								<span className="truncate">{company.name}</span>
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
						<TableCell className={NUMBER_CELL}>{formatShare(company.demand)}</TableCell>
						<TableCell className={NUMBER_CELL}>
							{company.attendance === null ? (
								<span className="text-muted-foreground">Ikke registrert</span>
							) : (
								formatShare(company.attendance)
							)}
						</TableCell>
						<TableCell className={NUMBER_CELL}>
							{company.lateUnregistrations ?? (
								<span className="text-muted-foreground">Ikke logget</span>
							)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function Companies({ companies }: Readonly<{ companies: CompanyStats[] | undefined }>) {
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
			<CompanyTable companies={companies} />
			<PanelBody>
				<PanelNote>{DEMAND_NOTE}</PanelNote>
			</PanelBody>
		</>
	);
}

export function CompaniesView({ now }: Readonly<{ now: number }>) {
	const { selected, select } = useSemesterSelect(now);
	const companies = useStableQuery(
		api.engagement.queries.companies,
		{ now, ...selected },
		`${selected.semester}-${selected.year}`,
	);

	return (
		<Panel title="Arrangementer per bedrift" aside={select}>
			<Companies companies={companies} />
		</Panel>
	);
}
