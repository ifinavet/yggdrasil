"use client";

import type { api } from "@workspace/backend/convex/api";
import {
	formatCount,
	formatNok,
	formatPercent,
	isEventProduct,
	type ProductSalesSummary,
	semesterAbbreviation,
	semesterLabel,
} from "@workspace/shared/products";
import { Badge } from "@workspace/ui/components/badge";
import { MiniBars } from "@workspace/ui/components/products/mini-bars";
import { ProductOfferCard } from "@workspace/ui/components/products/offer-card";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { Timeline, TimelineItem } from "@workspace/ui/components/products/timeline";
import type { FunctionReturnType } from "convex/server";
import { type ProductFormValues, toProductInput } from "./product-form-values";
import {
	changeAuthor,
	changeInitials,
	changeTimestamp,
	productChangeEntries,
} from "./product-history-format";
import { REVENUE_ESTIMATE_NOTE } from "./stats/sales-kpis";

type ProductChanges = NonNullable<
	FunctionReturnType<typeof api.products.queries.getWithChanges>
>["changes"];

function finiteOrUndefined(value: number | undefined) {
	return value !== undefined && Number.isFinite(value) ? value : undefined;
}

export function OfferPreviewPanel({ values }: Readonly<{ values: ProductFormValues }>) {
	if (!isEventProduct(values)) return null;
	return (
		<Panel
			title="Slik ser bedriftene det"
			aside={<Badge variant="outline">ifinavet.no/bedrifter</Badge>}
		>
			<PanelBody>
				<ProductOfferCard
					product={{
						name: values.name,
						longDescription: values.longDescription,
						unitPriceOre: finiteOrUndefined(toProductInput(values).unitPriceOre),
					}}
				/>
			</PanelBody>
		</Panel>
	);
}

export function SalesPanel({
	summary,
	isJobListing,
}: Readonly<{ summary: ProductSalesSummary; isJobListing: boolean }>) {
	const unit = isJobListing ? "annonser per semester" : "antall per semester";
	return (
		<Panel title="Salg av produktet" aside={<PanelNote>{unit}</PanelNote>}>
			<PanelBody>
				<MiniBars
					bars={summary.quantityBySemester.map(({ semester, quantity }) => ({
						label: semesterAbbreviation(semester),
						value: quantity,
						title: `${semesterLabel(semester)}: ${formatCount(quantity)}`,
					}))}
				/>
				<dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-3">
					<Fact label="Solgt totalt" value={formatCount(summary.quantity)} />
					<Fact label="Inntekt totalt" value={formatNok(summary.revenueOre)} />
					<Fact label="Andel av inntekt" value={formatPercent(summary.shareOfRevenue ?? 0)} />
				</dl>
				<p className="mt-3 text-[12.5px] text-muted-foreground">{REVENUE_ESTIMATE_NOTE}</p>
			</PanelBody>
		</Panel>
	);
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
	return (
		<div>
			<dt className="text-[12.5px] text-muted-foreground">{label}</dt>
			<dd className="font-semibold tabular-nums">{value}</dd>
		</div>
	);
}

export function ChangesPanel({ changes }: Readonly<{ changes: ProductChanges }>) {
	return (
		<Panel title="Endringer">
			<PanelBody className="py-1">
				<Timeline>
					{changes.flatMap((change) =>
						productChangeEntries(change.action, change.changes).map((entry) => (
							<TimelineItem
								key={`${change._id}-${entry.key}`}
								initials={changeInitials(change.changedByName)}
								meta={changeTimestamp(change._creationTime)}
								diff={
									entry.diff && (
										<>
											{entry.diff.before !== undefined && (
												<>
													<s>{entry.diff.before}</s>
													<span>→</span>
												</>
											)}
											<strong>{entry.diff.after}</strong>
										</>
									)
								}
							>
								<strong>{changeAuthor(change.changedByName)}</strong> {entry.description}
							</TimelineItem>
						)),
					)}
				</Timeline>
			</PanelBody>
		</Panel>
	);
}
