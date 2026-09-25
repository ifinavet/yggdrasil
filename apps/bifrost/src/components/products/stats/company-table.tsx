import {
	type CompanyHistory,
	formatNokFromOre,
	RECENT_SEMESTERS,
	type SemesterRef,
	semesterKey,
	semesterLabel,
} from "@workspace/shared/products";
import { ActivityDots } from "@workspace/ui/components/products/activity-dots";
import { Panel, PanelNote } from "@workspace/ui/components/products/panel";
import { Sparkline } from "@workspace/ui/components/products/sparkline";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { STATS_CELL, STATS_HEAD } from "./table-classes";

export function CompanyTable({
	companies,
	window,
	column,
}: Readonly<{
	companies: readonly CompanyHistory[];
	window: readonly SemesterRef[];
	column: SemesterRef;
}>) {
	const recent = window.slice(-RECENT_SEMESTERS);
	const columnKey = semesterKey(column);
	const max = Math.max(
		0,
		...companies.flatMap((company) =>
			recent.map((semester) => company.revenueBySemester[semesterKey(semester)] ?? 0),
		),
	);

	return (
		<Panel title="Bedrifter" aside={<PanelNote>sortert på inntekt siste fem år</PanelNote>}>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className={STATS_HEAD}>Bedrift</TableHead>
						<TableHead className={`${STATS_HEAD} text-right`}>{semesterLabel(column)}</TableHead>
						<TableHead className={STATS_HEAD}>Siste fire semestre</TableHead>
						<TableHead className={STATS_HEAD}>Aktiv i</TableHead>
						<TableHead className={`${STATS_HEAD} text-right`}>Totalt</TableHead>
						<TableHead className={STATS_HEAD}>Kunde siden</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{companies.map((company) => {
						const inColumn = company.revenueBySemester[columnKey] ?? 0;
						return (
							<TableRow key={company.companyId}>
								<TableCell className={`${STATS_CELL} font-medium`}>{company.companyName}</TableCell>
								<TableCell className={`${STATS_CELL} text-right tabular-nums`}>
									{inColumn > 0 ? (
										formatNokFromOre(inColumn)
									) : (
										<span className="text-muted-foreground">Ingen kjøp</span>
									)}
								</TableCell>
								<TableCell className={STATS_CELL}>
									<Sparkline
										max={max}
										values={recent.map((semester) => {
											const value = company.revenueBySemester[semesterKey(semester)] ?? 0;
											return {
												label: semesterKey(semester),
												value,
												title: `${semesterLabel(semester)}: ${formatNokFromOre(value)}`,
											};
										})}
									/>
								</TableCell>
								<TableCell className={STATS_CELL}>
									<ActivityDots active={company.activeSemesters} total={window.length} />
								</TableCell>
								<TableCell className={`${STATS_CELL} text-right font-semibold tabular-nums`}>
									{formatNokFromOre(company.totalOre)}
								</TableCell>
								<TableCell className={`${STATS_CELL} text-muted-foreground`}>
									{semesterLabel(company.customerSince)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</Panel>
	);
}
