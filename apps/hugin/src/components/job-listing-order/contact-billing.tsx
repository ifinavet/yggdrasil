"use client";

import { useStore } from "@tanstack/react-form";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { type ComponentProps, useState } from "react";
import { billingCopy, contactCopy } from "@/lib/job-listing-order/copy";
import { AddressInput } from "./address-input";
import { FormRow } from "./form-row";
import { OrderSection } from "./order-section";
import type { OrderFormApi } from "./use-order-form";

type TextFieldName =
	| "contact.name"
	| "contact.email"
	| "contact.phone"
	| "billing.email"
	| "billing.reference";

function TextField({
	form,
	name,
	label,
	...inputProps
}: Readonly<
	{ form: OrderFormApi; name: TextFieldName; label: string } & Pick<
		ComponentProps<"input">,
		"type" | "autoComplete" | "inputMode"
	>
>) {
	const id = `order-${name.replace(".", "-")}`;
	return (
		<form.Field name={name}>
			{(field) => (
				<FormRow label={label} htmlFor={id} errors={field.state.meta.errors}>
					<Input
						id={id}
						{...inputProps}
						value={field.state.value}
						aria-invalid={field.state.meta.errors.length > 0}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
					/>
				</FormRow>
			)}
		</form.Field>
	);
}

export function ContactFieldset({ form }: Readonly<{ form: OrderFormApi }>) {
	return (
		<OrderSection legend={contactCopy.legend}>
			<TextField form={form} name="contact.name" label={contactCopy.name} autoComplete="name" />
			<div className="grid gap-5 sm:grid-cols-2">
				<TextField
					form={form}
					name="contact.email"
					label={contactCopy.email}
					type="email"
					autoComplete="email"
				/>
				<TextField
					form={form}
					name="contact.phone"
					label={contactCopy.phone}
					type="tel"
					autoComplete="tel"
				/>
			</div>
		</OrderSection>
	);
}

export function BillingFieldset({
	form,
	required,
}: Readonly<{ form: OrderFormApi; required: boolean }>) {
	const changeBilling = useStore(form.store, (state) => state.values.changeBilling);
	const [addressId, setAddressId] = useState<string>();
	return (
		<OrderSection legend={billingCopy.legend}>
			{!required && (
				<form.Field name="changeBilling">
					{(field) => (
						<div className="flex items-center gap-3">
							<Checkbox
								id="order-change-billing"
								checked={field.state.value}
								onCheckedChange={(checked) => field.handleChange(checked === true)}
							/>
							<FieldLabel htmlFor="order-change-billing">{billingCopy.change}</FieldLabel>
						</div>
					)}
				</form.Field>
			)}
			{(required || changeBilling) && (
				<>
					<form.Field name="billing.address">
						{(field) => (
							<FormRow
								label={billingCopy.address}
								htmlFor={addressId}
								errors={field.state.meta.errors}
							>
								<AddressInput
									label={billingCopy.address}
									value={field.state.value}
									invalid={field.state.meta.errors.length > 0}
									onBlur={field.handleBlur}
									onChange={field.handleChange}
									onInputId={setAddressId}
								/>
							</FormRow>
						)}
					</form.Field>
					<div className="grid gap-5 sm:grid-cols-2">
						<TextField form={form} name="billing.email" label={billingCopy.email} type="email" />
						<TextField form={form} name="billing.reference" label={billingCopy.reference} />
					</div>
				</>
			)}
		</OrderSection>
	);
}
