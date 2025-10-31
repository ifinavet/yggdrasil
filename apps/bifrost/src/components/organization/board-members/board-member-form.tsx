"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@radix-ui/react-popover";
import { api } from "@workspace/backend/convex/api";
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
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components/form";
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
import { useForm } from "react-hook-form";
import {
	type boardMemberSchema,
	formSchema,
} from "@/constants/schemas/boardmember-form-schema";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";
import { ACCESS_RIGHTS } from "@workspace/shared/constants";

export default function BoardMemberForm({
	defaultValues,
	onSubmitAction,
	description,
	title,
	openDialog,
	setOpenDialogAction,
	button,
	className,
}: {
	defaultValues: boardMemberSchema;
	onSubmitAction: (values: boardMemberSchema) => void;
	description: string;
	title: string;
	openDialog: boolean;
	setOpenDialogAction: (open: boolean) => void;
	button: React.ReactNode;
	className?: string;
}) {
	const internalMembers = useQuery(api.internals.getAll);

	const form = useForm<boardMemberSchema>({
		resolver: zodV4Resolver(formSchema),
		defaultValues,
	});

	const [openMembers, setOpenMembers] = useState(false);

	useEffect(() => {
		if (!openDialog) {
			form.reset(defaultValues);
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
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmitAction)}
						className="space-y-8"
					>
						<FormField
							control={form.control}
							name="userId"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Ansvarlige</FormLabel>
									<FormControl>
										<Popover open={openMembers} onOpenChange={setOpenMembers}>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													aria-expanded={openMembers}
													className="w-[200px] justify-between"
													type="button"
												>
													{field.value
														? internalMembers?.find(
																(internalMember) =>
																	internalMember.userId === field.value,
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
																		field.onChange(
																			currentValue === field.value
																				? ""
																				: currentValue,
																		);
																		form.setValue(
																			"internalId",
																			internalMember._id,
																		);
																		setOpenMembers(false);
																	}}
																>
																	<Check
																		className={cn(
																			"mr-2 h-4 w-4",
																			field.value === internalMember.userId
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
									</FormControl>
									<FormDescription>Velg hvem som har vervet.</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="role"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Rolle</FormLabel>
									<FormControl>
										<Input {...field} placeholder="f.eks. Leder" />
									</FormControl>
									<FormDescription>Hva skal vervet hete?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="group"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Gruppe</FormLabel>
									<FormControl>
										<Input {...field} placeholder="f.eks. Webgruppen" />
									</FormControl>
									<FormDescription>
										Hva skal gruppen til vervet hete?
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="positionEmail"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Rolle epost</FormLabel>
									<FormControl>
										<Input {...field} placeholder="f.eks. leder@ifinavet.no" />
									</FormControl>
									<FormDescription>
										En valgri epost som bli brukt isteden for rolle inhaver sin
										egen.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="accessRole"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Tilgangsrolle</FormLabel>
									<FormControl>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
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
									</FormControl>
									<FormDescription>
										Hva slags tilgangsrolle skal denne personen ha?
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Avbryt</Button>
					</DialogClose>
					<Button type="submit" onClick={form.handleSubmit(onSubmitAction)}>
						Lagre
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
