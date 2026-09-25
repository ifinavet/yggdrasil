import { type CompanyHistory, formatNokFromOre, semesterLabel } from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import { Panel, PanelNote } from "@workspace/ui/components/products/panel";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import Link from "next/link";
import { STATS_CELL, STATS_HEAD } from "./table-classes";

export function LapsedCompanies({ companies }: Readonly<{ companies: readonly CompanyHistory[] }>) {
	return (
		<Panel title="Bør følges opp" aside={<PanelNote>har ikke kjøpt på to semestre</PanelNote>}>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className={STATS_HEAD}>Bedrift</TableHead>
						<TableHead className={STATS_HEAD}>Sist kjøpt</TableHead>
						<TableHead className={`${STATS_HEAD} text-right`}>Totalt</TableHead>
						<TableHead className={STATS_HEAD} />
					</TableRow>
				</TableHeader>
				<TableBody>
					{companies.map((company) => (
						<TableRow key={company.companyId}>
							<TableCell className={STATS_CELL}>{company.companyName}</TableCell>
							<TableCell className={STATS_CELL}>{semesterLabel(company.lastPurchase)}</TableCell>
							<TableCell className={`${STATS_CELL} text-right tabular-nums`}>
								{formatNokFromOre(company.totalOre)}
							</TableCell>
							<TableCell className={`${STATS_CELL} text-right`}>
								<Button variant="outline" size="sm" asChild>
									<Link href={`/companies/${company.companyId}`}>Åpne</Link>
								</Button>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Panel>
	);
}
