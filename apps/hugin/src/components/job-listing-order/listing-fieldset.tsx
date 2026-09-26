"use client";

import type { JobListingOrderSettings } from "@workspace/shared/job-listing-orders";
import { CharacterCount } from "@workspace/ui/components/character-count";
import { Input } from "@workspace/ui/components/input";
import { RichTextEditor } from "@workspace/ui/components/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { listingCopy } from "@/lib/job-listing-order/copy";
import { FormRow } from "./form-row";
import { OrderSection } from "./order-section";
import type { OrderFormApi } from "./use-order-form";

export function ListingFieldset({
	form,
	index,
	settings,
	today,
}: Readonly<{
	form: OrderFormApi;
	index: number;
	settings: JobListingOrderSettings;
	today: string;
}>) {
	const id = (name: string) => `order-listing-${index}-${name}`;

	return (
		<OrderSection legend={listingCopy.legend(index + 1)}>
			<form.Field name={`listings[${index}].title`}>
				{(field) => (
					<FormRow label={listingCopy.title} htmlFor={id("title")} errors={field.state.meta.errors}>
						<Input
							id={id("title")}
							value={field.state.value}
							maxLength={settings.titleMaxLength}
							aria-describedby={id("title-count")}
							aria-invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						<CharacterCount
							id={id("title-count")}
							length={field.state.value.length}
							max={settings.titleMaxLength}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name={`listings[${index}].teaser`}>
				{(field) => (
					<FormRow
						label={listingCopy.teaser}
						htmlFor={id("teaser")}
						errors={field.state.meta.errors}
					>
						<Textarea
							id={id("teaser")}
							rows={2}
							value={field.state.value}
							maxLength={settings.teaserMaxLength}
							aria-describedby={id("teaser-count")}
							aria-invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						<CharacterCount
							id={id("teaser-count")}
							length={field.state.value.length}
							max={settings.teaserMaxLength}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name={`listings[${index}].description`}>
				{(field) => (
					<FormRow
						label={listingCopy.description}
						htmlFor={id("description")}
						errors={field.state.meta.errors}
					>
						<RichTextEditor
							id={id("description")}
							value={field.state.value}
							invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={field.handleChange}
						/>
					</FormRow>
				)}
			</form.Field>
			<form.Field name={`listings[${index}].applicationUrl`}>
				{(field) => (
					<FormRow
						label={listingCopy.applicationUrl}
						htmlFor={id("url")}
						errors={field.state.meta.errors}
					>
						<Input
							id={id("url")}
							type="url"
							inputMode="url"
							placeholder={listingCopy.applicationUrlPlaceholder}
							value={field.state.value}
							aria-invalid={field.state.meta.errors.length > 0}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</FormRow>
				)}
			</form.Field>
			<div className="grid gap-5 sm:grid-cols-2">
				<form.Field name={`listings[${index}].deadline`}>
					{(field) => (
						<FormRow
							label={listingCopy.deadline}
							htmlFor={id("deadline")}
							errors={field.state.meta.errors}
						>
							<Input
								id={id("deadline")}
								type="date"
								min={today}
								value={field.state.value}
								aria-invalid={field.state.meta.errors.length > 0}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
						</FormRow>
					)}
				</form.Field>
				<form.Field name={`listings[${index}].type`}>
					{(field) => (
						<FormRow label={listingCopy.type} htmlFor={id("type")} errors={field.state.meta.errors}>
							<Select value={field.state.value} onValueChange={field.handleChange}>
								<SelectTrigger
									id={id("type")}
									className="w-full"
									aria-invalid={field.state.meta.errors.length > 0}
								>
									<SelectValue placeholder={listingCopy.typePlaceholder} />
								</SelectTrigger>
								<SelectContent>
									{settings.jobTypes.map((type) => (
										<SelectItem key={type} value={type}>
											{type}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormRow>
					)}
				</form.Field>
			</div>
		</OrderSection>
	);
}
