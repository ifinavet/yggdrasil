"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { JOB_TYPES } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components/command";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, Save, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import DateTimePicker from "@/components/common/forms/date-time-picker";
import DescriptionEditor from "@/components/common/forms/markdown-editor/editor";
import {
	formSchema,
	type JobListingFormValues,
} from "@/constants/schemas/job-listing-form-schema";
import ContactsSection from "./contacts-section";

type FormMeta = {
	submitAction: "primary" | "secondary" | "tertiary";
};

export default function JobListingForm({
	onPrimarySubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
	defaultValues,
}: Readonly<{
	onPrimarySubmitAction: (values: JobListingFormValues) => void;
	onSecondarySubmitAction: (values: JobListingFormValues) => void;
	onTertiarySubmitAction?: (values: JobListingFormValues) => void;
	defaultValues: JobListingFormValues;
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
					onPrimarySubmitAction(value);
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

	const [openCompanies, setOpenCompanies] = useState(false);
	const [companyValue, setCompanyValue] = useState(
		form.state.values.company.name,
	);

	const companies = useQuery(api.companies.getAll);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit({ submitAction: "primary" });
			}}
		>
			<FieldSet>
				<FieldGroup>
					<form.Field name="title">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
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
									<FieldDescription>
										Dette er hva stillingsannonsen skal hete.
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>
				<FieldSeparator />
				<FieldGroup className="flex flex-col gap-4 md:flex-row">
					<form.Field name="company">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field className="min-w-0 md:w-full">
									<FieldLabel>Velg arrangerende bedrift</FieldLabel>
									<Popover open={openCompanies} onOpenChange={setOpenCompanies}>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												aria-expanded={openCompanies}
												className="justify-between truncate"
											>
												{companyValue
													? companies?.find(
															(company) => company.name === companyValue,
														)?.name
													: "Velg en bedrift..."}
												<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-[200px] p-0" align="start">
											<Command>
												<CommandInput placeholder="Søk etter bedrift..." />
												<CommandList>
													<CommandEmpty>Fant ingen bedrift(er).</CommandEmpty>
													<CommandGroup>
														{companies?.map((company) => (
															<CommandItem
																key={company._id}
																value={company.name}
																onSelect={(currentValue) => {
																	setCompanyValue(
																		currentValue === companyValue
																			? ""
																			: currentValue,
																	);
																	field.handleChange({
																		name: currentValue,
																		id: company._id,
																	});
																	setOpenCompanies(false);
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		companyValue === company.name
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																{company.name}
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>
										Velg hvilken bedrift annonsen skal være knyttet til
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="deadline">
						{(field) => (
							<DateTimePicker
								field={field}
								label="Dato og tid for annonsen sin deadline"
								description="Velg dato og tid for når annonsen løper ut"
							/>
						)}
					</form.Field>

					<form.Field name="type">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;

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
											<SelectValue placeholder="Velg type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Fulltid">Fulltid</SelectItem>
											<SelectItem value="Deltid">Deltid</SelectItem>
											<SelectItem value="Internship">Internship</SelectItem>
											<SelectItem value="Sommerjobb">Sommerjobb</SelectItem>
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>
										Velg hvilken type annonsen skal være
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldSeparator />

				<form.Field name="teaser">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;

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
								<FieldDescription>
									Dette er en liten teaser av stillingsannonsen.
								</FieldDescription>
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

				<form.Field name="contacts">
					{(field) => <ContactsSection field={field} />}
				</form.Field>

				<FieldSeparator />

				<form.Field name="applicationUrl">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
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
								<FieldDescription>
									Lenken til stillingsannonsen.
								</FieldDescription>
							</Field>
						);
					}}
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
				<Button
					type="button"
					disabled={form.state.isSubmitting}
					variant="secondary"
					onClick={() => form.handleSubmit({ submitAction: "secondary" })}
				>
					<Save />{" "}
					{form.state.isSubmitting ? "Jobber..." : "Lagre og avpubliser"}
				</Button>
				{onTertiarySubmitAction && (
					<Button
						type="button"
						disabled={form.state.isSubmitting}
						variant="destructive"
						onClick={() => form.handleSubmit({ submitAction: "tertiary" })}
					>
						<Trash2 /> {form.state.isSubmitting ? "Jobber..." : "Slett"}
					</Button>
				)}
			</div>
		</form>
	);
}
