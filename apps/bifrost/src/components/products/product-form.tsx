"use client";

import { type AnyFieldApi, useForm } from "@tanstack/react-form";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { Plus, Save, Trash } from "lucide-react";
import type { ReactNode } from "react";
import {
	emptyTierFormValues,
	type ProductFormValues,
	validateProductForm,
} from "./product-form-values";

function errorsOf(field: AnyFieldApi) {
	return field.state.meta.errors.map((message) => ({ message: String(message) }));
}

function errorIdOf(field: AnyFieldApi) {
	return `${field.name}-error`;
}

function errorAttributesOf(field: AnyFieldApi) {
	const invalid = field.state.meta.errors.length > 0;
	return { "aria-invalid": invalid, "aria-describedby": invalid ? errorIdOf(field) : undefined };
}

function LabeledField({
	field,
	label,
	description,
	children,
}: Readonly<{ field: AnyFieldApi; label: string; description?: string; children: ReactNode }>) {
	return (
		<Field>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			{children}
			{description && <FieldDescription>{description}</FieldDescription>}
			<FieldError id={errorIdOf(field)} errors={errorsOf(field)} />
		</Field>
	);
}

function TextInput({
	field,
	inputMode,
}: Readonly<{ field: AnyFieldApi; inputMode?: "decimal" | "numeric" }>) {
	return (
		<Input
			id={field.name}
			name={field.name}
			inputMode={inputMode}
			value={field.state.value}
			onChange={(event) => field.handleChange(event.target.value)}
			onBlur={field.handleBlur}
			{...errorAttributesOf(field)}
		/>
	);
}

function TextArea({ field }: Readonly<{ field: AnyFieldApi }>) {
	return (
		<Textarea
			id={field.name}
			name={field.name}
			rows={5}
			value={field.state.value}
			onChange={(event) => field.handleChange(event.target.value)}
			onBlur={field.handleBlur}
			{...errorAttributesOf(field)}
		/>
	);
}

export default function ProductForm({
	defaultValues,
	submitLabel,
	onSubmit,
}: Readonly<{
	defaultValues: ProductFormValues;
	submitLabel: string;
	onSubmit: (values: ProductFormValues) => Promise<unknown>;
}>) {
	const form = useForm({
		defaultValues,
		validators: { onSubmit: ({ value }) => validateProductForm(value) },
		onSubmit: ({ value }) => onSubmit(value),
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
			className="max-w-2xl space-y-8"
		>
			<FieldSet>
				<form.Field name="name">
					{(field) => (
						<LabeledField field={field} label="Navn">
							<TextInput field={field} />
						</LabeledField>
					)}
				</form.Field>

				<form.Field name="category">
					{(field) => (
						<LabeledField
							field={field}
							label="Kategori"
							description="Kategorien bestemmer hvor produktet brukes."
						>
							<Select
								value={field.state.value}
								onValueChange={(value) =>
									field.handleChange(value as ProductFormValues["category"])
								}
							>
								<SelectTrigger id={field.name}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PRODUCT_CATEGORIES.map((category) => (
										<SelectItem key={category} value={category}>
											{PRODUCT_CATEGORY_LABELS[category]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</LabeledField>
					)}
				</form.Field>

				<form.Field name="shortDescription">
					{(field) => (
						<LabeledField field={field} label="Kort beskrivelse">
							<TextArea field={field} />
						</LabeledField>
					)}
				</form.Field>

				<form.Field name="longDescription">
					{(field) => (
						<LabeledField
							field={field}
							label="Lang beskrivelse"
							description="Tom linje mellom avsnitt gir et nytt punkt på nettsiden."
						>
							<TextArea field={field} />
						</LabeledField>
					)}
				</form.Field>

				<div className="grid gap-6 sm:grid-cols-3">
					<form.Field name="unitPrice">
						{(field) => (
							<LabeledField
								field={field}
								label="Pris (kr eks. mva.)"
								description="La stå tom hvis produktet ikke har fast pris."
							>
								<TextInput field={field} inputMode="decimal" />
							</LabeledField>
						)}
					</form.Field>
					<form.Field name="vatRate">
						{(field) => (
							<LabeledField field={field} label="Mva (%)">
								<TextInput field={field} inputMode="numeric" />
							</LabeledField>
						)}
					</form.Field>
					<form.Field name="maxStudents">
						{(field) => (
							<LabeledField
								field={field}
								label="Maks studenter"
								description="La stå tom for ubegrenset."
							>
								<TextInput field={field} inputMode="numeric" />
							</LabeledField>
						)}
					</form.Field>
				</div>

				<form.Subscribe selector={(state) => state.values.category}>
					{(category) =>
						category === "job_listing" && (
							<>
								<form.Field name="volumeTiers" mode="array">
									{(tiersField) => (
										<Field>
											<FieldLabel>Mengderabatter</FieldLabel>
											{tiersField.state.value.map((tier, index) => (
												<div key={tier.key} className="flex items-end gap-3">
													<form.Field name={`volumeTiers[${index}].quantity`}>
														{(field) => (
															<LabeledField field={field} label="Antall annonser">
																<TextInput field={field} inputMode="numeric" />
															</LabeledField>
														)}
													</form.Field>
													<form.Field name={`volumeTiers[${index}].totalPrice`}>
														{(field) => (
															<LabeledField field={field} label="Totalpris (kr)">
																<TextInput field={field} inputMode="decimal" />
															</LabeledField>
														)}
													</form.Field>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														aria-label="Fjern trinn"
														onClick={() => tiersField.removeValue(index)}
													>
														<Trash />
													</Button>
												</div>
											))}
											<FieldError errors={errorsOf(tiersField)} />
											<Button
												type="button"
												variant="outline"
												className="w-fit"
												onClick={() => tiersField.pushValue(emptyTierFormValues())}
											>
												<Plus /> Legg til trinn
											</Button>
										</Field>
									)}
								</form.Field>
								<form.Field name="startupPrice">
									{(field) => (
										<LabeledField
											field={field}
											label="Pris for oppstartsbedrifter (kr per annonse)"
										>
											<TextInput field={field} inputMode="decimal" />
										</LabeledField>
									)}
								</form.Field>
							</>
						)
					}
				</form.Subscribe>
			</FieldSet>

			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Button type="submit" disabled={isSubmitting}>
						<Save /> {isSubmitting ? "Jobber..." : submitLabel}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
