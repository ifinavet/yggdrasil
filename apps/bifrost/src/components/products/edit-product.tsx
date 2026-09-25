"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import {
	formatNok,
	productSalesSummary,
	semesterLabel,
	statsWindow,
} from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { ProductStatusBadge } from "@workspace/ui/components/products/product-badges";
import { Switch } from "@workspace/ui/components/switch";
import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { notifyProductMutation } from "./notify-product-mutation";
import ProductForm from "./product-form";
import { existingSalesNote, toProductFormValues, toProductInput } from "./product-form-values";
import { ChangesPanel, OfferPreviewPanel, SalesPanel } from "./product-panels";
import { ProductsBreadcrumb } from "./products-breadcrumb";
import { currentSemester } from "./semester-select";

function priceNoteFor(product: Doc<"products">, soldThisSemester: number) {
	if (product.category === "job_listing" || product.unitPriceOre === undefined) return null;
	return existingSalesNote(
		soldThisSemester,
		semesterLabel(currentSemester()).toLowerCase(),
		formatNok(product.unitPriceOre),
	);
}

export function EditProduct({ id }: Readonly<{ id: Id<"products"> }>) {
	const data = useQuery(api.products.queries.getWithChanges, { id });
	const sales = useQuery(api.products.stats.sales);
	const update = useMutation(api.products.mutations.update);
	const setActive = useMutation(api.products.mutations.setActive);
	const summary = useMemo(
		() => sales && productSalesSummary(sales, statsWindow(currentSemester()), id),
		[sales, id],
	);

	if (data === undefined) return null;
	if (data === null) return <p className="text-muted-foreground">Fant ikke produktet.</p>;
	const { product, changes } = data;

	const toggleActive = () =>
		notifyProductMutation(
			setActive({ id, active: !product.active }),
			product.active ? "Produktet er arkivert." : "Produktet er gjenopprettet.",
			"Kunne ikke endre status.",
		);

	return (
		<>
			<ProductsBreadcrumb current={product.name} />
			<ProductForm
				key={product._id}
				title={product.name}
				badge={<ProductStatusBadge active={product.active} />}
				actions={
					<Button type="button" variant="outline" onClick={toggleActive}>
						{product.active ? "Arkiver" : "Gjenopprett"}
					</Button>
				}
				defaultValues={toProductFormValues(product)}
				submitLabel="Lagre endringer"
				priceNote={
					summary && priceNoteFor(product, summary.quantityBySemester.at(-1)?.quantity ?? 0)
				}
				statusPanel={
					<Panel>
						<PanelBody className="flex items-center gap-3">
							<Switch id="product-active" checked={product.active} onCheckedChange={toggleActive} />
							<label htmlFor="product-active">
								<div className="font-medium">Aktiv</div>
								<div className="text-[13px] text-muted-foreground">
									Arkiverte produkter vises ikke på ifinavet.no og kan ikke velges på nye
									arrangementer.
								</div>
							</label>
						</PanelBody>
					</Panel>
				}
				aside={(values) => (
					<>
						<OfferPreviewPanel values={values} />
						{summary && (
							<SalesPanel summary={summary} isJobListing={product.category === "job_listing"} />
						)}
						<ChangesPanel changes={changes} />
					</>
				)}
				onSubmit={(values) =>
					notifyProductMutation(
						update({ id, ...toProductInput(values) }),
						"Produktet er lagret.",
						"Kunne ikke lagre produktet.",
					)
				}
			/>
		</>
	);
}
