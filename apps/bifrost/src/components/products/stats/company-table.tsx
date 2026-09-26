import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	type CompanyHistory,
	formatNokFromOre,
	RECENT_SEMESTERS,
	type SemesterRef,
	semesterKey,
	semesterLabel,
} from "@workspace/shared/products";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
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
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { useState } from "react";
import { STATS_CELL, STATS_HEAD } from "@/components/common/table-classes";
import { notifyProductMutation } from "../notify-product-mutation";

export function CompanyTable({
	companies,
	window,
	column,
}: Readonly<{
	companies: readonly CompanyHistory[];
	window: readonly SemesterRef[];
	column: SemesterRef;
}>) {
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const setExclusion = useMutation(api.products.revenueExclusion.setRevenueExclusion);
	const recent = window.slice(-RECENT_SEMESTERS);
	const columnKey = semesterKey(column);
	const max = Math.max(
		0,
		...companies.flatMap((company) =>
			recent.map((semester) => company.revenueBySemester[semesterKey(semester)] ?? 0),
		),
	);

	const selectedCompanies = companies.filter((company) => selected.has(company.companyId));
	const includeSelected =
		selectedCompanies.length > 0 && selectedCompanies.every((company) => company.excluded);
	const allSelected = companies.length > 0 && selected.size === companies.length;

	const toggle = (companyId: string, checked: boolean) => {
		const next = new Set(selected);
		if (checked) next.add(companyId);
		else next.delete(companyId);
		setSelected(next);
	};

	const toggleExclusion = async () => {
		const updated = await notifyProductMutation(
			setExclusion({
				companyIds: [...selected] as Id<"companies">[],
				excluded: !includeSelected,
			}),
			includeSelected
				? "Bedriftene er tatt med i inntekten."
				: "Bedriftene er ekskludert fra inntekten.",
			"Kunne ikke oppdatere bedriftene.",
		);
		if (updated) setSelected(new Set());
	};

	return (
		<Panel
			title="Bedrifter"
			aside={
				<div className="flex items-center gap-3">
					<PanelNote>sortert på inntekt siste fem år</PanelNote>
					<Button
						variant="outline"
						size="sm"
						disabled={selected.size === 0}
						onClick={toggleExclusion}
					>
						{includeSelected ? "Ta med i inntekt" : "Ekskluder fra inntekt"} ({selected.size})
					</Button>
				</div>
			}
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className={`${STATS_HEAD} w-10`}>
							<Checkbox
								aria-label="Velg alle"
								checked={allSelected}
								onCheckedChange={(checked) =>
									setSelected(new Set(checked ? companies.map((company) => company.companyId) : []))
								}
							/>
						</TableHead>
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
							<TableRow
								key={company.companyId}
								className={cn(company.excluded && "text-muted-foreground opacity-60")}
							>
								<TableCell className={STATS_CELL}>
									<Checkbox
										aria-label={`Velg ${company.companyName}`}
										checked={selected.has(company.companyId)}
										onCheckedChange={(checked) => toggle(company.companyId, checked === true)}
									/>
								</TableCell>
								<TableCell className={`${STATS_CELL} font-medium`}>
									<span className="flex items-center gap-2">
										{company.companyName}
										{company.excluded && <Badge variant="outline">Ekskludert</Badge>}
									</span>
								</TableCell>
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
