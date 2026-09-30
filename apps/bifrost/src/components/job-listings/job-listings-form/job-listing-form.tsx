"use client";

import { useForm } from "@tanstack/react-form";
import { JOB_TYPES } from "@workspace/shared/constants";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
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
import { Save, Send, Trash2 } from "lucide-react";
import CompanySelectField from "@/components/common/forms/company-select-field";
import DateTimePicker from "@/components/common/forms/date-time-picker";
import FormSubmitActions, {
	formSubmitOptions,
	handleFormSubmit,
} from "@/components/common/forms/form-submit-actions";
import DescriptionEditor from "@/components/common/forms/markdown-editor/editor";
import {
	type JobListingFormValues,
	jobListingFormSchema,
} from "@/constants/schemas/job-listing-form-schema";
import { JobTypeLabel } from "../job-type-label";
import ContactsSection from "./contacts-section";

export default function JobListingForm({
	onPrimarySubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
	defaultValues,
	latestDeadline,
}: Readonly<{
	onPrimarySubmitAction: (values: JobListingFormValues) => void | Promise<void>;
	onSecondarySubmitAction: (values: JobListingFormValues) => void | Promise<void>;
	onTertiarySubmitAction?: (values: JobListingFormValues) => void | Promise<void>;
	defaultValues: JobListingFormValues;
	latestDeadline: Date;
}>) {
	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: jobListingFormSchema(latestDeadline),
		},
		...formSubmitOptions({
			primary: onPrimarySubmitAction,
			secondary: onSecondarySubmitAction,
			tertiary: onTertiarySubmitAction,
		}),
	});

	return (
		<form
			onSubmit={(event) =>
				handleFormSubmit(event, () => form.handleSubmit({ submitAction: "primary" }))
			}
		>
			<FieldSet>
				<FieldGroup>
					<form.Field name="title">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Tittel</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="Stillingsannonse med Navet"
										className="truncate"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>Dette er hva stillingsannonsen skal hete.</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>
				<FieldSeparator />
				<FieldGroup className="flex flex-col gap-4 md:flex-row">
					<form.Field name="company">
						{(field) => (
							<CompanySelectField
								company={field.state.value}
								onCompanyChange={(company) => field.handleChange(company)}
								errors={field.state.meta.errors}
								isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
							/>
						)}
					</form.Field>

					<form.Field name="deadline">
						{(field) => (
							<DateTimePicker
								field={field}
								label="Dato og tid for annonsen sin deadline"
								description="Velg dato og tid for når annonsen løper ut"
								latestDate={latestDeadline}
							/>
						)}
					</form.Field>

					<form.Field name="type">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Type</FieldLabel>
									<Select
										onValueChange={(value) =>
											field.handleChange(value as (typeof JOB_TYPES)[number])
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Velg type">
												{field.state.value ? <JobTypeLabel type={field.state.value} /> : null}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{JOB_TYPES.map((type) => (
												<SelectItem key={type} textValue={type} value={type}>
													<JobTypeLabel type={type} />
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>Velg hvilken type annonsen skal være</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldSeparator />

				<form.Field name="teaser">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Teaser</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
									className="truncate"
									placeholder="eks. Har du lyst til å jobbe med Navet?"
								/>
								<FieldDescription>Dette er en liten teaser av stillingsannonsen.</FieldDescription>
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<DescriptionEditor
							field={field}
							title="Beskrivelse"
							description="Dette er beskrivelsen av stillingen."
						/>
					)}
				</form.Field>

				<FieldSeparator />

				<form.Field name="contacts">{(field) => <ContactsSection field={field} />}</form.Field>

				<FieldSeparator />

				<form.Field name="applicationUrl">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Annonselenke</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
									placeholder="eks. https://ifinavet.no/ny-intern"
									className="truncate"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								<FieldDescription>Lenken til stillingsannonsen.</FieldDescription>
							</Field>
						);
					}}
				</form.Field>
			</FieldSet>

			<FormSubmitActions
				className="mb-4"
				isSubmitting={form.state.isSubmitting}
				onSubmitAction={(submitAction) => form.handleSubmit({ submitAction })}
				primary={{ label: "Lagre og publiser", icon: <Send /> }}
				secondary={{ label: "Lagre og avpubliser", icon: <Save /> }}
				tertiary={onTertiarySubmitAction && { label: "Slett", icon: <Trash2 /> }}
			/>
		</form>
	);
}
