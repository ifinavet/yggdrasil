"use client";

import { useStore } from "@tanstack/react-form";
import type { api } from "@workspace/backend/convex/api";
import { orderPriceOre, packageSizes } from "@workspace/shared/job-listing-orders";
import { formatNok } from "@workspace/shared/products";
import { FieldLabel } from "@workspace/ui/components/field";
import { SegmentedControl, SegmentedControlItem } from "@workspace/ui/components/segmented-control";
import { Switch } from "@workspace/ui/components/switch";
import type { FunctionReturnType } from "convex/server";
import { Info } from "lucide-react";
import { packageCopy } from "@/lib/job-listing-order/copy";
import { resizeListings } from "@/lib/job-listing-order/form-values";
import { ErrorLine } from "./form-row";
import { OrderSection } from "./order-section";
import type { OrderFormApi } from "./use-order-form";

export const PACKAGE_SECTION_ID = "order-package";

export type ListingProduct = NonNullable<
	FunctionReturnType<typeof api.jobListingOrders.form.product>
>;

export function PackagePicker({
	form,
	product,
}: Readonly<{ form: OrderFormApi; product: ListingProduct }>) {
	const quantity = useStore(form.store, (state) => state.values.listings.length);
	const startup = useStore(form.store, (state) => state.values.startup);
	const offersStartup = product.startupPriceOre !== undefined;

	return (
		<OrderSection id={PACKAGE_SECTION_ID} legend={packageCopy.legend}>
			<div className="flex flex-col gap-1">
				<span className="font-medium">{product.name}</span>
				<span className="text-muted-foreground text-sm">{product.shortDescription}</span>
			</div>
			<div className="flex flex-col gap-2">
				<FieldLabel id="order-quantity">{packageCopy.quantity}</FieldLabel>
				<SegmentedControl
					aria-labelledby="order-quantity"
					value={String(quantity)}
					onValueChange={(value) =>
						form.setFieldValue("listings", (listings) => resizeListings(listings, Number(value)))
					}
					className="w-fit"
				>
					{packageSizes(product).map((size) => (
						<SegmentedControlItem key={size} value={String(size)} className="min-w-10 text-sm">
							{size}
						</SegmentedControlItem>
					))}
				</SegmentedControl>
				<p className="flex items-start gap-2 rounded-lg bg-primary-light px-3 py-2.5 text-primary text-sm dark:bg-accent dark:text-accent-foreground">
					<Info className="mt-0.5 size-4 flex-none" />
					{packageCopy.quantityInfo}
				</p>
				<form.Field name="listings">
					{(field) => <ErrorLine errors={field.state.meta.errors} />}
				</form.Field>
			</div>
			{offersStartup && (
				<form.Field name="startup">
					{(field) => (
						<div className="flex items-center gap-3">
							<Switch
								id="order-startup"
								checked={field.state.value}
								onCheckedChange={field.handleChange}
							/>
							<FieldLabel htmlFor="order-startup">{packageCopy.startup}</FieldLabel>
						</div>
					)}
				</form.Field>
			)}
			<div className="flex items-baseline justify-between border-t pt-4">
				<span className="text-muted-foreground">{packageCopy.price}</span>
				<output className="font-semibold text-xl">
					{formatNok(orderPriceOre(product, quantity, startup && offersStartup))}
				</output>
			</div>
		</OrderSection>
	);
}
