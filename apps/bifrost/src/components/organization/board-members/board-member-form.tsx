"use client";

import { useForm } from "@tanstack/react-form";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@radix-ui/react-popover";
import { api } from "@workspace/backend/convex/api";
import { ACCESS_RIGHTS } from "@workspace/shared/constants";
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
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
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
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type boardMemberSchema,
	formSchema,
} from "@/constants/schemas/boardmember-form-schema";

export default function BoardMemberForm({
	defaultValues,
	onSubmitAction,
	description,
	title,
	openDialog,
	setOpenDialogAction,
	button,
	className,
}: Readonly<{
	defaultValues: boardMemberSchema;
	onSubmitAction: (values: boardMemberSchema) => void;
	description: string;
	title: string;
	openDialog: boolean;
	setOpenDialogAction: (open: boolean) => void;
	button: React.ReactNode;
	className?: string;
}>) {
	const internalMembers = useQuery(api.internals.getAll);
	const [openMembers, setOpenMembers] = useState(false);

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			onSubmitAction(value);
		},
	});

	useEffect(() => {
		if (!openDialog) {
			form.reset();
		}
	}, [openDialog, form]);

	if (!internalMembers)
		return (
			<Button variant="outline" size="sm" className={className} disabled>
				{button}
			</Button>
		);

	return (
		<Dialog open={openDialog} onOpenChange={setOpenDialogAction}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className={className}>
					{button}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-8"
				>
					<FieldSet>
						<form.Field name="userId">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field className="flex flex-col">
										<FieldLabel>Ansvarlige</FieldLabel>
										<Popover open={openMembers} onOpenChange={setOpenMembers}>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													aria-expanded={openMembers}
													className="w-[200px] justify-between"
													type="button"
												>
													{field.state.value
														? internalMembers?.find(
																(internalMember) =>
																	internalMember.userId === field.state.value,
															)?.fullName
														: "Velg et medlem..."}
													<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-[200px] p-0">
												<Command>
													<CommandInput placeholder="Søk etter en ansvarlig..." />
													<CommandList>
														<CommandEmpty>
															Fant ingen ansvarlige(er).
														</CommandEmpty>
														<CommandGroup>
															{internalMembers?.map((internalMember) => (
																<CommandItem
																	key={internalMember.userId}
																	value={internalMember.userId ?? "Ukjent"}
																	onSelect={(currentValue) => {
																		field.handleChange(
																			currentValue === field.state.value
																				? ""
																				: currentValue,
																		);
																		setOpenMembers(false);
																	}}
																>
																	<Check
																		className={cn(
																			"mr-2 h-4 w-4",
																			field.state.value ===
																				internalMember.userId
																				? "opacity-100"
																				: "opacity-0",
																		)}
																	/>
																	{internalMember.fullName}
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</Popover>
										<FieldDescription>
											Velg hvem som har vervet.
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="role">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field>
										<FieldLabel htmlFor={field.name}>Rolle</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											aria-invalid={isInvalid}
											placeholder="f.eks. Leder"
										/>
										<FieldDescription>Hva skal vervet hete?</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="group">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field>
										<FieldLabel htmlFor={field.name}>Gruppe</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											aria-invalid={isInvalid}
											placeholder="f.eks. Webgruppen"
										/>
										<FieldDescription>
											Hva skal gruppen til vervet hete?
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="positionEmail">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field>
										<FieldLabel htmlFor={field.name}>Rolle epost</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											aria-invalid={isInvalid}
											placeholder="f.eks. leder@ifinavet.no"
										/>
										<FieldDescription>
											En valgri epost som bli brukt isteden for rolle inhaver
											sin egen.
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>

						<form.Field name="accessRole">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field>
										<FieldLabel htmlFor={field.name}>Tilgangsrolle</FieldLabel>
										<Select
											onValueChange={(value) =>
												field.handleChange(
													value as (typeof ACCESS_RIGHTS)[number],
												)
											}
											defaultValue={field.state.value}
										>
											<SelectTrigger>
												<SelectValue
													placeholder="Velg tilgangsrolle"
													className="capitalize"
												/>
											</SelectTrigger>
											<SelectContent>
												{ACCESS_RIGHTS.map((accessRight) => (
													<SelectItem
														value={accessRight}
														key={accessRight}
														className="capitalize"
													>
														{accessRight}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldDescription>
											Hva slags tilgangsrolle skal denne personen ha?
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
					</FieldSet>
				</form>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Avbryt</Button>
					</DialogClose>
					<Button
						type="submit"
						disabled={form.state.isSubmitting}
						onClick={() => form.handleSubmit()}
					>
						{form.state.isSubmitting ? "Lagrer..." : "Lagre"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
