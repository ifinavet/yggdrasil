"use client";

import { useStore } from "@tanstack/react-form";
import type { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { RichTextEditor } from "@workspace/ui/components/rich-text-editor";
import type { FunctionReturnType } from "convex/server";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { SafeHtml } from "@/components/safe-html";
import { companyCopy } from "@/lib/job-listing-order/copy";
import type { CompanyValues } from "@/lib/job-listing-order/form-values";
import { CompanyPicker } from "./company-picker";
import { ErrorLine, FormRow } from "./form-row";
import { LogoPreview, LogoUploadField, useLogoUpload } from "./logo-upload";
import { OrderSection } from "./order-section";
import type { OrderFormApi } from "./use-order-form";

type CompanyOption = FunctionReturnType<typeof api.jobListingOrders.form.companies>[number];
export type CompanyCard = NonNullable<
	FunctionReturnType<typeof api.jobListingOrders.form.companyCard>
>;

export function CompanySection({
	form,
	companies,
	card,
}: Readonly<{
	form: OrderFormApi;
	companies: readonly CompanyOption[];
	card: CompanyCard | null | undefined;
}>) {
	const company = useStore(form.store, (state) => state.values.company);

	const selectCompany = (next: CompanyValues) => {
		form.setFieldValue("company", next);
		form.setFieldValue("companyCorrect", "");
		form.setFieldValue("companyChanges", { displayName: "", description: "", logo: "" });
		form.setFieldValue("changeBilling", false);
	};

	return (
		<OrderSection legend={companyCopy.legend}>
			<form.Field name="company.companyId">
				{(field) => (
					<FormRow
						label={companyCopy.placeholder}
						htmlFor="order-company"
						errors={field.state.meta.errors}
					>
						<CompanyPicker
							id="order-company"
							value={company}
							companies={companies}
							invalid={field.state.meta.errors.length > 0}
							onChange={selectCompany}
						/>
					</FormRow>
				)}
			</form.Field>
			{company.kind === "existing" && company.companyId && card && (
				<CompanyConfirmCard key={card._id} form={form} card={card} />
			)}
			{company.kind === "new" && <NewCompanyFields key={company.orgNumber} form={form} />}
		</OrderSection>
	);
}

function CompanyConfirmCard({ form, card }: Readonly<{ form: OrderFormApi; card: CompanyCard }>) {
	const [logoPreview, setLogoPreview] = useState<string>();
	const answer = useStore(form.store, (state) => state.values.companyCorrect);

	const answerNo = () => {
		const changes = form.getFieldValue("companyChanges");
		if (
			form.getFieldValue("companyCorrect") !== "no" &&
			!changes.displayName &&
			!changes.description
		) {
			form.setFieldValue("companyChanges", {
				...changes,
				displayName: card.name,
				description: card.description,
			});
		}
		form.setFieldValue("companyCorrect", "no");
	};

	const logo = useLogoUpload((uploaded) => {
		answerNo();
		form.setFieldValue("companyChanges.logo", uploaded.storageId);
		setLogoPreview(uploaded.previewUrl);
	});

	return (
		<div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
			<div className="flex items-start gap-4">
				<div className="relative flex-none">
					{logoPreview ? (
						<LogoPreview url={logoPreview} name={card.name} fallback={null} />
					) : (
						<CompanyLogo name={card.name} url={card.logoUrl} size="lg" />
					)}
					<Button
						type="button"
						size="icon"
						variant="outline"
						aria-label={companyCopy.editLogo}
						disabled={logo.uploading}
						onClick={logo.open}
						className="absolute -right-2 -bottom-2 size-7 rounded-full"
					>
						<Pencil className="size-3.5" />
					</Button>
					{logo.fileInput}
				</div>
				<div className="flex min-w-0 flex-col gap-1">
					<span className="font-semibold text-lg">{card.name}</span>
					<span className="text-muted-foreground text-sm">
						{card.hasBilling ? companyCopy.billingOnFile : companyCopy.billingMissing}
					</span>
				</div>
			</div>
			{logo.uploading && (
				<span className="text-muted-foreground text-sm">{companyCopy.logoUploading}</span>
			)}
			{logo.error && <FieldError>{logo.error}</FieldError>}
			<SafeHtml html={card.description} className="prose prose-sm dark:prose-invert max-w-none" />
			<form.Field name="companyCorrect">
				{(field) => (
					<div className="flex flex-col gap-2">
						<FieldLabel id="order-company-correct">{companyCopy.correctQuestion}</FieldLabel>
						<RadioGroup
							aria-labelledby="order-company-correct"
							aria-invalid={field.state.meta.errors.length > 0}
							value={field.state.value}
							onValueChange={(value) => {
								if (value === "no") answerNo();
								else field.handleChange("yes");
							}}
							className="flex gap-6"
						>
							{(["yes", "no"] as const).map((option) => (
								<label
									key={option}
									className="flex items-center gap-2 text-sm"
									htmlFor={`order-company-${option}`}
								>
									<RadioGroupItem id={`order-company-${option}`} value={option} />
									{companyCopy[option]}
								</label>
							))}
						</RadioGroup>
						<ErrorLine errors={field.state.meta.errors} />
					</div>
				)}
			</form.Field>
			{answer === "no" && <CompanyChangeFields form={form} />}
		</div>
	);
}

function CompanyChangeFields({ form }: Readonly<{ form: OrderFormApi }>) {
	return (
		<div className="flex flex-col gap-5 border-t pt-5">
			<span className="text-muted-foreground text-sm">{companyCopy.changesHint}</span>
			<form.Field name="companyChanges.displayName">
				{(field) => (
					<FormRow
						label={companyCopy.displayName}
						htmlFor="order-changes-name"
						errors={field.state.meta.errors}
					>
						<Input
							id="order-changes-name"
							value={field.state.value}
							aria-invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name="companyChanges.description">
				{(field) => (
					<FormRow
						label={companyCopy.description}
						htmlFor="order-changes-description"
						errors={field.state.meta.errors}
					>
						<RichTextEditor
							id="order-changes-description"
							value={field.state.value}
							invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={field.handleChange}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name="companyChanges">
				{(field) => <ErrorLine errors={field.state.meta.errors} />}
			</form.Field>
		</div>
	);
}

function NewCompanyFields({ form }: Readonly<{ form: OrderFormApi }>) {
	const [logoPreview, setLogoPreview] = useState<string>();
	const company = useStore(form.store, (state) => state.values.company);

	return (
		<div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
			<div className="grid gap-5 sm:grid-cols-2">
				<ReadOnlyValue label={companyCopy.registryName} value={company.registryName} />
				<ReadOnlyValue label={companyCopy.orgNumber} value={company.orgNumber} />
			</div>
			<form.Field name="company.displayName">
				{(field) => (
					<FormRow
						label={companyCopy.displayName}
						htmlFor="order-company-name"
						errors={field.state.meta.errors}
					>
						<Input
							id="order-company-name"
							value={field.state.value}
							aria-invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name="company.description">
				{(field) => (
					<FormRow
						label={companyCopy.description}
						htmlFor="order-company-description"
						errors={field.state.meta.errors}
					>
						<RichTextEditor
							id="order-company-description"
							value={field.state.value}
							invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={field.handleChange}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name="company.logo">
				{(field) => (
					<FormRow
						label={companyCopy.logo}
						htmlFor="order-company-logo"
						errors={field.state.meta.errors}
					>
						<LogoUploadField
							id="order-company-logo"
							previewUrl={logoPreview}
							name={company.displayName}
							hasLogo={field.state.value !== ""}
							invalid={field.state.meta.errors.length > 0}
							onUploaded={(uploaded) => {
								field.handleChange(uploaded.storageId);
								setLogoPreview(uploaded.previewUrl);
							}}
						/>
					</FormRow>
				)}
			</form.Field>
		</div>
	);
}

function ReadOnlyValue({ label, value }: Readonly<{ label: string; value: string }>) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-muted-foreground text-sm">{label}</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}
