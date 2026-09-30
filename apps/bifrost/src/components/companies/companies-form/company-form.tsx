"use client";

import { useForm } from "@tanstack/react-form";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Send, Trash } from "lucide-react";
import { formSubmitOptions, handleFormSubmit } from "@/components/common/forms/form-submit-actions";
import DescriptionEditor from "@/components/common/forms/markdown-editor/editor";
import { type CompanyFormValues, formSchema } from "@/constants/schemas/companies-form-schema";
import SelectImage from "./select-image";

export default function CompanyForm({
	defaultValues,
	onPrimarySubmitAction,
	onSecondarySubmitAction,
}: Readonly<{
	defaultValues: CompanyFormValues;
	onPrimarySubmitAction: (values: CompanyFormValues) => void | Promise<void>;
	onSecondarySubmitAction?: (values: CompanyFormValues) => void | Promise<void>;
}>) {
	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: formSchema,
		},
		...formSubmitOptions({
			primary: onPrimarySubmitAction,
			secondary: onSecondarySubmitAction,
		}),
	});

	return (
		<form onSubmit={(event) => handleFormSubmit(event, form.handleSubmit)} className="space-y-8">
			<FieldSet>
				<form.Field name="name">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Bedrifts navn</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
								/>
								<FieldDescription>Skriv inn bedriftens navn her.</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="orgNumber">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Org. nr.</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
								/>
								<FieldDescription>Skriv inn bedriftens organisasjonsnummer her.</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="image">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel>Bedrifts bilde</FieldLabel>
								<SelectImage field={field} />
								<FieldDescription>Velg et bilde for bedriften her.</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<DescriptionEditor
							field={field}
							title="beskrivelse"
							description="Dette er beskrivelsen av bedriften."
						/>
					)}
				</form.Field>
			</FieldSet>

			<div className="mb-4 flex gap-4">
				<Button
					type="button"
					disabled={form.state.isSubmitting}
					onClick={() => form.handleSubmit({ submitAction: "primary" })}
				>
					<Send /> {form.state.isSubmitting ? "Jobber..." : "Lagre og publiser"}
				</Button>
				{onSecondarySubmitAction && (
					<Button
						type="button"
						disabled={form.state.isSubmitting}
						variant="destructive"
						onClick={() => form.handleSubmit({ submitAction: "secondary" })}
					>
						<Trash /> {form.state.isSubmitting ? "Jobber..." : "Slett Bedrift"}
					</Button>
				)}
			</div>
		</form>
	);
}
