"use client";

import { type AnyFieldApi, useForm, useStore } from "@tanstack/react-form";
import {
	formatNokFromOre,
	PRODUCT_CATEGORIES,
	PRODUCT_CATEGORY_LABELS,
} from "@workspace/shared/products";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { AffixInput } from "@workspace/ui/components/products/affix-input";
import { Callout } from "@workspace/ui/components/products/callout";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import {
	emptyTierFormValues,
	type ProductFormValues,
	perListingOre,
	priceWithVatOre,
	validateProductForm,
} from "./product-form-values";
import { OfferPreviewPanel } from "./product-panels";

const TIER_HEAD = "pb-1.5 text-left font-medium text-[13px] text-muted-foreground";

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

function inputAttributesOf(field: AnyFieldApi) {
	return {
		id: field.name,
		name: field.name,
		value: field.state.value,
		onChange: (event: { target: { value: string } }) => field.handleChange(event.target.value),
		onBlur: field.handleBlur,
		...errorAttributesOf(field),
	};
}

function LabeledField({
	field,
	label,
	description,
	className,
	children,
}: Readonly<{
	field: AnyFieldApi;
	label: string;
	description?: string;
	className?: string;
	children: ReactNode;
}>) {
	return (
		<Field className={className}>
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
			inputMode={inputMode}
			className={inputMode && "tabular-nums"}
			{...inputAttributesOf(field)}
		/>
	);
}

function AmountInput({
	field,
	affix,
	inputMode = "decimal",
}: Readonly<{ field: AnyFieldApi; affix: string; inputMode?: "decimal" | "numeric" }>) {
	return <AffixInput affix={affix} inputMode={inputMode} {...inputAttributesOf(field)} />;
}

function formatOptionalNok(ore: number | undefined) {
	return ore === undefined ? "" : formatNokFromOre(ore);
}

export default function ProductForm({
	title,
	badge,
	actions,
	defaultValues,
	submitLabel,
	priceNote,
	statusPanel,
	aside,
	onSubmit,
}: Readonly<{
	title: string;
	badge?: ReactNode;
	actions?: ReactNode;
	defaultValues: ProductFormValues;
	submitLabel: string;
	priceNote?: string | null;
	statusPanel?: ReactNode;
	aside?: ReactNode;
	onSubmit: (values: ProductFormValues) => Promise<unknown>;
}>) {
	const form = useForm({
		defaultValues,
		validators: { onSubmit: ({ value }) => validateProductForm(value) },
		onSubmit: ({ value }) => onSubmit(value),
	});
	const values = useStore(form.store, (state) => state.values);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="mb-5 flex flex-wrap items-center gap-3">
				<h1 className="font-semibold text-[22px]">{title}</h1>
				{badge}
				<div className="ml-auto flex gap-2">
					{actions}
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Jobber..." : submitLabel}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</div>

			<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
				<div className="flex min-w-0 flex-col gap-4">
					<Panel>
						<PanelBody className="flex flex-col gap-4">
							<div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
								<form.Field name="name">
									{(field) => (
										<LabeledField field={field} label="Navn">
											<TextInput field={field} />
										</LabeledField>
									)}
								</form.Field>
								<form.Field name="category">
									{(field) => (
										<LabeledField field={field} label="Kategori">
											<Select
												value={field.state.value}
												onValueChange={(value) =>
													field.handleChange(value as ProductFormValues["category"])
												}
											>
												<SelectTrigger id={field.name} className="w-full">
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
							</div>
							<form.Field name="shortDescription">
								{(field) => (
									<LabeledField field={field} label="Kort beskrivelse">
										<TextInput field={field} />
									</LabeledField>
								)}
							</form.Field>
							<form.Field name="longDescription">
								{(field) => (
									<LabeledField
										field={field}
										label="Lang beskrivelse"
										description="Vises på ifinavet.no/bedrifter. Tom linje gir nytt avsnitt."
									>
										<Textarea rows={5} {...inputAttributesOf(field)} />
									</LabeledField>
								)}
							</form.Field>
						</PanelBody>
					</Panel>

					<form.Subscribe selector={(state) => state.values.category}>
						{(category) =>
							category === "job_listing" ? (
								<form.Field name="volumeTiers" mode="array">
									{(tiersField) => (
										<Panel
											title="Mengderabatter"
											aside={
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => tiersField.pushValue(emptyTierFormValues())}
												>
													<Plus /> Legg til trinn
												</Button>
											}
										>
											<PanelBody className="flex flex-col gap-4">
												<table className="-mx-2 w-[calc(100%+1rem)] border-separate border-spacing-x-2 border-spacing-y-1.5 text-sm">
													<thead>
														<tr>
															<th className={TIER_HEAD}>Antall annonser</th>
															<th className={TIER_HEAD}>Totalpris eks. mva.</th>
															<th className={TIER_HEAD}>Per annonse</th>
															<th className="w-9" />
														</tr>
													</thead>
													<tbody>
														{tiersField.state.value.map((tier, index) => (
															<tr key={tier.key}>
																<td>
																	<form.Field name={`volumeTiers[${index}].quantity`}>
																		{(field) => (
																			<Input
																				inputMode="numeric"
																				className="tabular-nums"
																				aria-label="Antall annonser"
																				{...inputAttributesOf(field)}
																			/>
																		)}
																	</form.Field>
																</td>
																<td>
																	<form.Field name={`volumeTiers[${index}].totalPrice`}>
																		{(field) => (
																			<AffixInput
																				affix="kr"
																				inputMode="decimal"
																				aria-label="Totalpris eks. mva."
																				{...inputAttributesOf(field)}
																			/>
																		)}
																	</form.Field>
																</td>
																<td className="text-muted-foreground tabular-nums">
																	{formatOptionalNok(perListingOre(tier))}
																</td>
																<td>
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		aria-label="Fjern trinn"
																		onClick={() => tiersField.removeValue(index)}
																	>
																		<X />
																	</Button>
																</td>
															</tr>
														))}
													</tbody>
												</table>
												<FieldError id={errorIdOf(tiersField)} errors={errorsOf(tiersField)} />
												<div className="grid gap-4 sm:grid-cols-2">
													<form.Field name="startupPrice">
														{(field) => (
															<LabeledField
																field={field}
																label="Pris for oppstartsbedrifter"
																description="Per annonse, uansett antall."
															>
																<AmountInput field={field} affix="kr" />
															</LabeledField>
														)}
													</form.Field>
													<form.Field name="vatRate">
														{(field) => (
															<LabeledField field={field} label="Mva">
																<AmountInput field={field} affix="%" inputMode="numeric" />
															</LabeledField>
														)}
													</form.Field>
												</div>
												<Callout>Trinnene regnes per bedrift per semester.</Callout>
											</PanelBody>
										</Panel>
									)}
								</form.Field>
							) : (
								<Panel title="Pris og kapasitet">
									<PanelBody className="flex flex-col gap-4">
										<div className="grid gap-4 sm:grid-cols-3">
											<form.Field name="unitPrice">
												{(field) => (
													<LabeledField field={field} label="Pris eks. mva.">
														<AmountInput field={field} affix="kr" />
													</LabeledField>
												)}
											</form.Field>
											<form.Field name="vatRate">
												{(field) => (
													<LabeledField field={field} label="Mva">
														<AmountInput field={field} affix="%" inputMode="numeric" />
													</LabeledField>
												)}
											</form.Field>
											<form.Field name="maxStudents">
												{(field) => (
													<LabeledField field={field} label="Maks studenter">
														<TextInput field={field} inputMode="numeric" />
													</LabeledField>
												)}
											</form.Field>
										</div>
										<form.Subscribe selector={(state) => priceWithVatOre(state.values)}>
											{(withVat) =>
												withVat !== undefined && (
													<Callout>
														Bedriften betaler{" "}
														<strong className="tabular-nums">{formatNokFromOre(withVat)}</strong>{" "}
														inkl. mva.{priceNote && ` ${priceNote}`}
													</Callout>
												)
											}
										</form.Subscribe>
									</PanelBody>
								</Panel>
							)
						}
					</form.Subscribe>

					{statusPanel}
				</div>

				<div className="flex min-w-0 flex-col gap-4">
					<OfferPreviewPanel values={values} />
					{aside}
				</div>
			</div>
		</form>
	);
}
