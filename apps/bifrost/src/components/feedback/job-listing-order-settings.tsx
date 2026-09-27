"use client";

import { type AnyFieldApi, useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import {
	type JobListingOrderSettings,
	jobListingOrderSettingsSchema,
} from "@workspace/shared/job-listing-orders";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";

function isInvalid(field: AnyFieldApi) {
	return field.state.meta.errors.length > 0;
}

export function JobListingOrderSettingsPanel() {
	const settings = useQuery(api.jobListingOrders.settings.current, {});
	if (!settings) {
		return <output className="text-muted-foreground text-sm">Henter innstillinger …</output>;
	}
	return <JobListingOrderSettingsForm settings={settings} />;
}

function JobListingOrderSettingsForm({
	settings,
}: Readonly<{ settings: JobListingOrderSettings }>) {
	const save = useMutation(api.jobListingOrders.settings.save);
	const form = useForm({
		defaultValues: settings,
		validators: { onSubmit: jobListingOrderSettingsSchema },
		onSubmit: async ({ value }) => {
			try {
				await save({ settings: jobListingOrderSettingsSchema.parse(value) });
				toast.success("Innstillinger lagret");
			} catch (error) {
				toast.error(convexErrorMessage(error, "Kunne ikke lagre innstillingene. Prøv igjen."));
			}
		},
	});

	return (
		<form
			className="flex max-w-2xl flex-col gap-8"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="open">
					{(field) => (
						<Field orientation="horizontal">
							<Switch
								id={field.name}
								checked={field.state.value}
								onCheckedChange={field.handleChange}
							/>
							<FieldContent>
								<FieldLabel htmlFor={field.name}>Ta imot bestillinger</FieldLabel>
								<FieldDescription>
									Når skjemaet er stengt, kan bedrifter ikke sende inn nye bestillinger.
								</FieldDescription>
							</FieldContent>
						</Field>
					)}
				</form.Field>

				<form.Field name="intro">
					{(field) => (
						<Field data-invalid={isInvalid(field)}>
							<FieldLabel htmlFor={field.name}>Tekst øverst i skjemaet</FieldLabel>
							<Textarea
								id={field.name}
								rows={4}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={isInvalid(field)}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<div className="grid gap-6 sm:grid-cols-2">
					<form.Field name="titleMaxLength">
						{(field) => (
							<Field data-invalid={isInvalid(field)}>
								<FieldLabel htmlFor={field.name}>Maks tegn i tittelen</FieldLabel>
								<Input
									id={field.name}
									type="number"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.valueAsNumber)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid(field)}
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>
					<form.Field name="teaserMaxLength">
						{(field) => (
							<Field data-invalid={isInvalid(field)}>
								<FieldLabel htmlFor={field.name}>Maks tegn i introen</FieldLabel>
								<Input
									id={field.name}
									type="number"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.valueAsNumber)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid(field)}
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>
				</div>

				<form.Field name="jobTypes" mode="array">
					{(typesField) => (
						<Field data-invalid={isInvalid(typesField)}>
							<FieldLabel>Ansettelsesformer</FieldLabel>
							<ul className="flex flex-col gap-2">
								{typesField.state.value.map((_, index) => (
									<form.Field key={`jobType-${index.toString()}`} name={`jobTypes[${index}]`}>
										{(field) => (
											<li className="flex flex-col gap-1">
												<div className="flex gap-2">
													<Input
														aria-label={`Ansettelsesform ${index + 1}`}
														value={field.state.value}
														onChange={(event) => field.handleChange(event.target.value)}
														onBlur={field.handleBlur}
														aria-invalid={isInvalid(field)}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														aria-label={`Fjern ${field.state.value}`}
														onClick={() => typesField.removeValue(index)}
													>
														<TrashIcon />
													</Button>
												</div>
												<FieldError errors={field.state.meta.errors} />
											</li>
										)}
									</form.Field>
								))}
							</ul>
							<Button
								type="button"
								variant="outline"
								className="self-start"
								onClick={() => typesField.pushValue("")}
							>
								<PlusIcon />
								Legg til ansettelsesform
							</Button>
							<FieldError errors={typesField.state.meta.errors} />
						</Field>
					)}
				</form.Field>
			</FieldGroup>

			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Button type="submit" className="self-start" disabled={isSubmitting}>
						Lagre
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
