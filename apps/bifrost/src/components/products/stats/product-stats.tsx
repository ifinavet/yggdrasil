"use client";

import { api } from "@workspace/backend/convex/api";
import {
	companyActivity,
	companyHistories,
	lapsedCompanies,
	productMix,
	revenuePerSemester,
	salesInSemester,
	salesInWindow,
	salesOverview,
	semesterFromKey,
	semesterLabel,
	statsWindow,
} from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import { Callout } from "@workspace/ui/components/products/callout";
import { Delta, Kpi, KpiStrip } from "@workspace/ui/components/products/kpi";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
	ALL_SEMESTERS,
	currentSemester,
	currentSemesterKey,
	SemesterSelect,
} from "../semester-select";
import { CompanyTable } from "./company-table";
import { LapsedCompanies } from "./lapsed-companies";
import { ProductMix } from "./product-mix";
import { RetentionChart } from "./retention-chart";
import { RevenueChart } from "./revenue-chart";
import { guessedWarning, REVENUE_ESTIMATE_NOTE, salesKpis } from "./sales-kpis";

const ALL_SEMESTERS_LABEL = "Alle semestre";

export function ProductStats() {
	const sales = useQuery(api.products.stats.sales);
	const [semester, setSemester] = useState(currentSemesterKey);
	const window = useMemo(() => statsWindow(currentSemester()), []);

	const view = useMemo(() => {
		if (!sales) return null;
		const selectedKey = semester === ALL_SEMESTERS ? null : semester;
		const selected =
			selectedKey === null ? salesInWindow(sales, window) : salesInSemester(sales, selectedKey);
		const overview = salesOverview(sales, window, selectedKey, Date.now());
		const histories = companyHistories(sales, window);
		return {
			selectedKey,
			overview,
			scopeLabel:
				selectedKey === null ? ALL_SEMESTERS_LABEL : semesterLabel(semesterFromKey(selectedKey)),
			revenue: revenuePerSemester(sales, window),
			mix: productMix(selected),
			activity: companyActivity(sales, window),
			histories,
			lapsed: lapsedCompanies(histories, window),
		};
	}, [sales, semester, window]);

	if (!view) return null;

	const { totals } = view.overview;
	const warning = guessedWarning(totals.guessedEvents, totals.eventsSold, view.scopeLabel);

	return (
		<section className="space-y-5">
			<div className="flex flex-wrap items-center gap-3">
				<h2 className="font-semibold text-[22px] tracking-[-0.3px]">Salg</h2>
				<div className="ml-auto">
					<SemesterSelect
						semesters={[...window].reverse()}
						value={semester}
						onChange={setSemester}
						includeAll
					/>
				</div>
			</div>

			<Callout>{REVENUE_ESTIMATE_NOTE}</Callout>

			{warning && (
				<Callout
					tone="warning"
					action={
						<Button variant="outline" size="sm" asChild>
							<Link href="/products/tag">Merk arrangementer</Link>
						</Button>
					}
				>
					{warning}
				</Callout>
			)}

			<KpiStrip>
				{salesKpis(view.overview, view.selectedKey === null).map((kpi) => (
					<Kpi
						key={kpi.label}
						label={kpi.label}
						value={kpi.value}
						detail={<Delta change={kpi.change} suffix={kpi.suffix} />}
					/>
				))}
			</KpiStrip>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
				<RevenueChart
					semesters={view.revenue}
					selectedKey={view.selectedKey}
					onSelect={setSemester}
				/>
				<ProductMix rows={view.mix} scopeLabel={view.scopeLabel} />
			</div>

			<div className="grid gap-5 lg:grid-cols-2">
				<RetentionChart activity={view.activity} />
				<LapsedCompanies companies={view.lapsed} />
			</div>

			<CompanyTable
				companies={view.histories}
				window={window}
				column={view.selectedKey === null ? currentSemester() : semesterFromKey(view.selectedKey)}
			/>
		</section>
	);
}
