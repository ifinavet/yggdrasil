"use client";

import { useForm } from "@tanstack/react-form";
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
import { EyeOff, Save, Send } from "lucide-react";
import CompanySelectField from "@/components/common/forms/company-select-field";
import DateTimePicker from "@/components/common/forms/date-time-picker";
import FormSubmitActions from "@/components/common/forms/form-submit-actions";
import DescriptionEditor from "@/components/common/forms/markdown-editor/editor";
import { type EventFormValues, formSchema } from "@/constants/schemas/event-form-schema";
import Organizers from "./organizers";

type FormMeta = {
	submitAction: "primary" | "secondary" | "tertiary";
};

export default function EventForm({
	onDefaultSubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
	defaultValues,
}: Readonly<{
	onDefaultSubmitAction: (values: EventFormValues) => void;
	onSecondarySubmitAction: (values: EventFormValues) => void;
	onTertiarySubmitAction?: (values: EventFormValues) => void;
	defaultValues: EventFormValues;
}>) {
	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: formSchema,
		},
		onSubmitMeta: {
			submitAction: "primary",
		} as FormMeta,
		onSubmit: async ({ value, meta }) => {
			switch (meta.submitAction) {
				case "primary":
					onDefaultSubmitAction(value);
					break;
				case "secondary":
					onSecondarySubmitAction(value);
					break;
				case "tertiary":
					onTertiarySubmitAction?.(value);
					break;
				default:
					break;
			}
		},
	});

	return (
		<form className="space-y-4">
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
										placeholder="Bedriftspresentasjon med Navet"
										className="truncate"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>Dette er hva arrangementet skal hete.</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldSeparator />

				<FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<form.Field name="food">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Mat</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="Sushi"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="location">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Sted</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="Månen"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="participantsLimit">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Deltaker grense</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="number"
										value={field.state.value === 0 ? "" : field.state.value}
										onChange={(e) => {
											const inputValue = e.target.value;
											if (inputValue === "") {
												field.handleChange(0);
											} else {
												const numValue = Number.parseInt(inputValue, 10);
												field.handleChange(Number.isNaN(numValue) ? 0 : numValue);
											}
										}}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="40"
										min="0"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="ageRestrictions">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Aldersbegrensninger</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="18 års aldersgrense"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="language">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Språk</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="Norsk"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="hostingCompany">
						{(field) => (
							<CompanySelectField
								company={field.state.value}
								onCompanyChange={(company) => field.handleChange(company)}
								errors={field.state.meta.errors}
								isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
							/>
						)}
					</form.Field>
				</FieldGroup>

				<FieldSeparator />

				<FieldGroup className="grid gap-4 sm:grid-cols-2">
					<form.Field name="eventDate">
						{(field) => (
							<DateTimePicker
								field={field}
								label="Dato og tid for arrangements start"
								description="Velg dato og tid for når arrangementet starter"
							/>
						)}
					</form.Field>

					<form.Field name="registrationDate">
						{(field) => (
							<DateTimePicker
								field={field}
								label="Dato og tid for åpning av påmelding"
								description="Velg dato og tid for åpning av påmeldingen av arrangementet"
							/>
						)}
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
									placeholder="Velkommen til en magisk aften med Navet"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								<FieldDescription>Dette er en liten teaser av arrangementet.</FieldDescription>
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<DescriptionEditor
							field={field}
							title="Beskrivelse"
							description="Dette er beskrivelsen for arrangementet."
						/>
					)}
				</form.Field>

				<FieldSeparator />

				<form.Field name="organizers">{(field) => <Organizers field={field} />}</form.Field>

				<FieldSeparator />

				<form.Field name="externalEvent">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Arrangementtype</FieldLabel>
								<Select
									onValueChange={(value) => field.handleChange(value === "true")}
									value={field.state.value ? "true" : "false"}
								>
									<SelectTrigger className="w-45">
										<SelectValue placeholder="Velg arrangementtype" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="false">Internt</SelectItem>
										<SelectItem value="true">Eksternt</SelectItem>
									</SelectContent>
								</Select>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="externalUrl">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Link til ekstern påmelding</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
									placeholder="f.eks. https://ifinavet.no/"
									className="truncate"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								<FieldDescription>
									Legg til en URL for ekstern påmelding til arrangementet
								</FieldDescription>
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
				secondary={{ label: "Lagre", icon: <Save /> }}
				tertiary={onTertiarySubmitAction && { label: "Lagre og avpubliser", icon: <EyeOff /> }}
			/>
		</form>
	);
}
