"use client";

import { useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { type JobListingOrderSettings, orderPriceOre } from "@workspace/shared/job-listing-orders";
import { formatNokFromOre } from "@workspace/shared/products";
import { osloToday } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { errorText } from "@/components/input-cards/question-block";
import { orderPageCopy, submitCopy } from "@/lib/job-listing-order/copy";
import { clearDraft, saveDraft } from "@/lib/job-listing-order/draft";
import {
	billingRequired,
	type CompanyOnFile,
	type OrderContext,
	toOrderForm,
} from "@/lib/job-listing-order/submit";
import { CompanySection } from "./company-section";
import { BillingFieldset, ContactFieldset } from "./contact-billing";
import { FormRow } from "./form-row";
import { ListingFieldset } from "./listing-fieldset";
import { type ListingProduct, PackagePicker } from "./package-picker";
import { type OrderFormApi, useOrderForm } from "./use-order-form";

type CompanyOption = FunctionReturnType<typeof api.jobListingOrders.form.companies>[number];

export type SubmittedOrder = Readonly<{ email: string; submissionId: string }>;

export function OrderForm({
	settings,
	product,
	companies,
	onSubmitted,
}: Readonly<{
	settings: JobListingOrderSettings;
	product: ListingProduct;
	companies: readonly CompanyOption[];
	onSubmitted: (order: SubmittedOrder) => void;
}>) {
	const submit = useAction(api.jobListingOrders.submit.submit);
	const formElement = useRef<HTMLFormElement>(null);
	const [submitError, setSubmitError] = useState<string>();
	const context = useRef<OrderContext>({ productId: product._id, companyOnFile: null });

	const form = useOrderForm({
		settings,
		context,
		onSubmit: async (values) => {
			setSubmitError(undefined);
			const submissionId = crypto.randomUUID();
			try {
				await submit({
					form: toOrderForm(values, context.current),
					submissionId,
					website: values.website,
				});
				clearDraft();
				onSubmitted({ email: values.contact.email, submissionId });
			} catch (error) {
				setSubmitError(convexErrorMessage(error, submitCopy.failed));
			}
		},
	});

	const values = useStore(form.store, (state) => state.values);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const { company } = values;
	const card = useQuery(
		api.jobListingOrders.form.companyCard,
		company.kind === "existing" && company.companyId
			? { companyId: company.companyId as Id<"companies"> }
			: "skip",
	);
	const companyOnFile: CompanyOnFile | null = card ?? null;
	context.current = { productId: product._id, companyOnFile };

	useEffect(() => {
		saveDraft(values);
	}, [values]);

	const today = osloToday(Date.now());

	return (
		<div className="mx-auto w-full max-w-3xl">
			<h1 className="mb-2 font-bold text-2xl text-primary dark:text-primary-foreground">
				{orderPageCopy.title}
			</h1>
			<p className="mb-8 text-muted-foreground">{settings.intro}</p>
			<form
				ref={formElement}
				noValidate
				onSubmit={async (event) => {
					event.preventDefault();
					await form.handleSubmit();
					if (!form.state.isValid) {
						setSubmitError(submitCopy.invalid);
						formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
					}
				}}
			>
				<fieldset disabled={isSubmitting} className="relative flex min-w-0 flex-col gap-10">
					<CompanySection form={form} companies={companies} card={card} />
					<PackagePicker form={form} product={product} />
					{values.listings.map((_, index) => (
						<ListingFieldset
							key={`listing-${index.toString()}`}
							form={form}
							index={index}
							settings={settings}
							today={today}
						/>
					))}
					<ContactFieldset form={form} />
					<BillingFieldset form={form} required={billingRequired(values, companyOnFile)} />
					<SubmitSection
						form={form}
						price={formatNokFromOre(orderPriceOre(product, values.listings.length, values.startup))}
					/>
				</fieldset>
				{submitError && (
					<p role="alert" className="mt-6 text-destructive text-sm">
						{submitError}
					</p>
				)}
				<Button type="submit" disabled={isSubmitting} className="mt-6 h-12 w-full font-semibold">
					{isSubmitting ? submitCopy.submitting : submitCopy.submit}
				</Button>
			</form>
		</div>
	);
}

function SubmitSection({ form, price }: Readonly<{ form: OrderFormApi; price: string }>) {
	return (
		<div className="flex flex-col gap-5 border-t pt-8">
			<form.Field name="note">
				{(field) => (
					<FormRow label={submitCopy.note} htmlFor="order-note" errors={field.state.meta.errors}>
						<Textarea
							id="order-note"
							rows={3}
							value={field.state.value}
							aria-invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name="website">
				{(field) => (
					<div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
						<label htmlFor="order-website">{submitCopy.honeypot}</label>
						<input
							id="order-website"
							tabIndex={-1}
							autoComplete="off"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>
			<form.Field name="confirmAmount">
				{(field) => (
					<div className="flex flex-col gap-2">
						<div className="flex items-start gap-3">
							<Checkbox
								id="order-confirm-amount"
								checked={field.state.value}
								aria-invalid={field.state.meta.errors.length > 0}
								onCheckedChange={(checked) => field.handleChange(checked === true)}
							/>
							<FieldLabel htmlFor="order-confirm-amount" className="leading-snug">
								{submitCopy.confirmAmount(price)}
							</FieldLabel>
						</div>
						<FieldError>{errorText(field.state.meta.errors)}</FieldError>
					</div>
				)}
			</form.Field>
		</div>
	);
}
