"use client";

import { useStore } from "@tanstack/react-form";
import type { api } from "@workspace/backend/convex/api";
import {
	type JobListingOrderSettings,
	MAX_LISTINGS_PER_ORDER,
	orderPriceOre,
} from "@workspace/shared/job-listing-orders";
import { formatNokFromOre } from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import { FieldError, FieldLabel } from "@workspace/ui/components/field";
import { SegmentedControl, SegmentedControlItem } from "@workspace/ui/components/segmented-control";
import { Switch } from "@workspace/ui/components/switch";
import type { FunctionReturnType } from "convex/server";
import { Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { errorText } from "@/components/input-cards/question-block";
import { packageCopy } from "@/lib/job-listing-order/copy";
import { emptyListing, type ListingValues } from "@/lib/job-listing-order/form-values";
import { ListingFieldset } from "./listing-fieldset";
import { OrderSection } from "./order-section";
import type { OrderFormApi } from "./use-order-form";

export const PACKAGE_SECTION_ID = "order-package";
export type ListingProduct = NonNullable<
	FunctionReturnType<typeof api.jobListingOrders.form.product>
>;

export function PackagePicker({
	form,
	product,
	settings,
	today,
}: Readonly<{
	form: OrderFormApi;
	product: ListingProduct;
	settings: JobListingOrderSettings;
	today: string;
}>) {
	const listings = useStore(form.store, (state) => state.values.listings);
	const startup = useStore(form.store, (state) => state.values.startup);
	const savedExtras = useRef<ListingValues[]>([]);
	const addButton = useRef<HTMLButtonElement>(null);
	const multiple = listings.length > 1;
	const offersStartup = product.startupPriceOre !== undefined;

	function updateListings(next: ListingValues[]) {
		form.setFieldValue("listings", next);
		form.setFieldValue("confirmAmount", false);
	}

	function setMultiple(value: string) {
		if (value === "yes") {
			updateListings([
				...listings.slice(0, 1),
				...(savedExtras.current.length ? savedExtras.current : [emptyListing()]),
			]);
			savedExtras.current = [];
		} else {
			savedExtras.current = listings.slice(1);
			updateListings(listings.slice(0, 1));
		}
	}

	return (
		<OrderSection id={PACKAGE_SECTION_ID} legend={packageCopy.legend}>
			{product.shortDescription && (
				<p className="text-muted-foreground text-sm">{product.shortDescription}</p>
			)}
			<ListingFieldset form={form} index={0} settings={settings} today={today} />
			<div className="flex flex-col items-start gap-3 border-t pt-5">
				<FieldLabel id="order-more-listings">{packageCopy.multipleQuestion}</FieldLabel>
				<SegmentedControl
					aria-labelledby="order-more-listings"
					value={multiple ? "yes" : "no"}
					onValueChange={setMultiple}
					className="w-fit"
				>
					<SegmentedControlItem value="no" className="min-h-11 min-w-20 text-sm">
						{packageCopy.no}
					</SegmentedControlItem>
					<SegmentedControlItem value="yes" className="min-h-11 min-w-20 text-sm">
						{packageCopy.yes}
					</SegmentedControlItem>
				</SegmentedControl>
			</div>
			{multiple && (
				<div className="flex min-w-0 flex-col gap-6">
					{listings.slice(1).map((_, offset) => {
						const index = offset + 1;
						return (
							<div key={`listing-${index}`} className="border-t pt-6">
								<ListingFieldset
									form={form}
									index={index}
									settings={settings}
									today={today}
									action={
										index === listings.length - 1 ? (
											<Button
												type="button"
												variant="ghost"
												className="min-h-11"
												aria-label={packageCopy.removeLabel(index + 1)}
												onClick={() => {
													updateListings(listings.slice(0, -1));
													requestAnimationFrame(() =>
														multiple && index > 1
															? addButton.current?.focus()
															: document
																	.getElementById("order-more-listings")
																	?.parentElement?.querySelector<HTMLButtonElement>("button")
																	?.focus(),
													);
												}}
											>
												<Trash2 aria-hidden="true" />
												{packageCopy.remove}
											</Button>
										) : undefined
									}
								/>
							</div>
						);
					})}
					<Button
						ref={addButton}
						type="button"
						variant="outline"
						className="min-h-11 w-full sm:w-fit"
						disabled={listings.length >= MAX_LISTINGS_PER_ORDER}
						onClick={() => {
							const index = listings.length;
							updateListings([...listings, emptyListing()]);
							requestAnimationFrame(() =>
								document.getElementById(`order-listing-${index}-title`)?.focus(),
							);
						}}
					>
						<Plus aria-hidden="true" />
						{packageCopy.add}
					</Button>
					{listings.length >= MAX_LISTINGS_PER_ORDER && (
						<p className="text-muted-foreground text-sm">
							{packageCopy.limit(MAX_LISTINGS_PER_ORDER)}
						</p>
					)}
				</div>
			)}
			<form.Field name="listings">
				{(field) => <FieldError>{errorText(field.state.meta.errors)}</FieldError>}
			</form.Field>
			<div className="flex flex-col gap-4 border-t pt-5">
				{offersStartup && (
					<form.Field name="startup">
						{(field) => (
							<div className="flex min-h-11 items-center gap-3">
								<Switch
									id="order-startup"
									checked={field.state.value}
									onCheckedChange={(checked) => {
										field.handleChange(checked);
										form.setFieldValue("confirmAmount", false);
									}}
								/>
								<FieldLabel htmlFor="order-startup">{packageCopy.startup}</FieldLabel>
							</div>
						)}
					</form.Field>
				)}
				<div className="flex flex-wrap items-baseline justify-between gap-3">
					<span>{packageCopy.total(listings.length)}</span>
					<output className="font-semibold text-xl tabular-nums">
						{formatNokFromOre(orderPriceOre(product, listings.length, startup && offersStartup))}
					</output>
				</div>
			</div>
		</OrderSection>
	);
}
