"use client";

import { type AnyFieldApi, useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	type JobListingOrderSettings,
	LISTING_FIELD_LABELS,
	type OrderListing,
	orderListingSchema,
} from "@workspace/shared/job-listing-orders";
import { osloToday } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { RichTextEditor } from "@workspace/ui/components/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useMutation } from "convex/react";
import type { ReactNode } from "react";
import { toast } from "sonner";

function isInvalid(field: AnyFieldApi) {
	return field.state.meta.errors.length > 0;
}

function LabeledField({
	field,
	label,
	children,
}: Readonly<{ field: AnyFieldApi; label: string; children: ReactNode }>) {
	return (
		<Field data-invalid={isInvalid(field)}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			{children}
			<FieldError errors={field.state.meta.errors} />
		</Field>
	);
}

function TextInput({ field, type }: Readonly<{ field: AnyFieldApi; type?: "date" | "url" }>) {
	return (
		<Input
			id={field.name}
			name={field.name}
			type={type}
			value={field.state.value}
			onChange={(event) => field.handleChange(event.target.value)}
			onBlur={field.handleBlur}
			aria-invalid={isInvalid(field)}
		/>
	);
}

export function OrderItemEditor({
	itemId,
	listing,
	settings,
	onDone,
}: Readonly<{
	itemId: Id<"jobListingOrderItems">;
	listing: OrderListing;
	settings: JobListingOrderSettings;
	onDone: () => void;
}>) {
	const updateItem = useMutation(api.jobListingOrders.admin.updateItem);
	const form = useForm({
		defaultValues: listing,
		validators: { onSubmit: orderListingSchema(settings, osloToday(Date.now())) },
		onSubmit: async ({ value }) => {
			try {
				await updateItem({ itemId, ...value });
				toast.success("Annonsen er oppdatert");
				onDone();
			} catch (error) {
				toast.error(convexErrorMessage(error, "Kunne ikke lagre annonsen."));
			}
		},
	});

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="title">
					{(field) => (
						<LabeledField field={field} label={LISTING_FIELD_LABELS.title}>
							<TextInput field={field} />
						</LabeledField>
					)}
				</form.Field>
				<form.Field name="teaser">
					{(field) => (
						<LabeledField field={field} label={LISTING_FIELD_LABELS.teaser}>
							<TextInput field={field} />
						</LabeledField>
					)}
				</form.Field>
				<form.Field name="description">
					{(field) => (
						<LabeledField field={field} label={LISTING_FIELD_LABELS.description}>
							<RichTextEditor
								id={field.name}
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								invalid={isInvalid(field)}
							/>
						</LabeledField>
					)}
				</form.Field>
				<form.Field name="applicationUrl">
					{(field) => (
						<LabeledField field={field} label={LISTING_FIELD_LABELS.applicationUrl}>
							<TextInput field={field} type="url" />
						</LabeledField>
					)}
				</form.Field>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.Field name="deadline">
						{(field) => (
							<LabeledField field={field} label={LISTING_FIELD_LABELS.deadline}>
								<TextInput field={field} type="date" />
							</LabeledField>
						)}
					</form.Field>
					<form.Field name="type">
						{(field) => (
							<LabeledField field={field} label={LISTING_FIELD_LABELS.type}>
								<Select value={field.state.value} onValueChange={field.handleChange}>
									<SelectTrigger id={field.name} aria-invalid={isInvalid(field)}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{settings.jobTypes.map((type) => (
											<SelectItem key={type} value={type}>
												{type}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</LabeledField>
						)}
					</form.Field>
				</div>
			</FieldGroup>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onDone}>
					Avbryt
				</Button>
				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting}>
							Lagre
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}
