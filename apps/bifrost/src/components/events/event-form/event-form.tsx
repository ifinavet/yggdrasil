"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
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
	FieldLabel,
	FieldSeparator,
	FieldSet,
	FieldGroup,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, EyeOff, Save, Send } from "lucide-react";
import { useState } from "react";
import {
	type EventFormValues,
	formSchema,
} from "@/constants/schemas/event-form-schema";
import Organizers from "./organizers";
import DescriptionEditor from "@/components/common/forms/markdown-editor/editor";
import DateTimePicker from "@/components/common/forms/date-time-picker";

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

	const [openCompanies, setOpenCompanies] = useState(false);
	const [companyValue, setCompanyValue] = useState(
		form.state.values.hostingCompany.name,
	);

	const isExternal = useStore(form.store, (state) => state.values.eventType);

	const companies = useQuery(api.companies.getAll);

	return (
		<form className="space-y-4">
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
										placeholder="Bedriftspresentasjon med Navet"
										className="truncate"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>
										Dette er hva arrangementet skal hete.
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldSeparator />

				<FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<form.Field name="food">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
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
												field.handleChange(
													Number.isNaN(numValue) ? 0 : numValue,
												);
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>
										Aldersbegrensninger
									</FieldLabel>
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
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
									placeholder="Velkommen til en magisk aften med Navet"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								<FieldDescription>
									Dette er en liten teaser av arrangementet.
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
							description="Dette er beskrivelsen for arrangementet."
						/>
					)}
				</form.Field>

				<FieldSeparator />

				<form.Field name="organizers">
					{(field) => <Organizers field={field} />}
				</form.Field>

				<FieldSeparator />

				<form.Field name="eventType">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;

						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Arrangementtype</FieldLabel>
								<Select
									onValueChange={(value) => {
										field.handleChange(
											value as "internal_event" | "external_event",
										);
										if (value === "internal_event") {
											form.setFieldValue("externalUrl", "");
										}
									}}
									value={field.state.value}
								>
									<SelectTrigger className="w-[180px]">
										<SelectValue placeholder="Velg arrangementtype" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="internal_event">Internt</SelectItem>
										<SelectItem value="external_event">Eksternt</SelectItem>
									</SelectContent>
								</Select>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				{isExternal === "external_event" && (
					<form.Field name="externalUrl">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>
										Link til arrangementet
									</FieldLabel>
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
										Legg til en url til det eksterne arrangementet
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				)}
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
					<Save /> {form.state.isSubmitting ? "Jobber..." : "Lagre"}
				</Button>
				{onTertiarySubmitAction && (
					<Button
						type="button"
						disabled={form.state.isSubmitting}
						variant="destructive"
						onClick={() => form.handleSubmit({ submitAction: "tertiary" })}
					>
						<EyeOff />{" "}
						{form.state.isSubmitting ? "Jobber..." : "Lagre og avpubliser"}
					</Button>
				)}
			</div>
		</form>
	);
}
