"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components//button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components//command";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components//form";
import { Input } from "@workspace/ui/components//input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components//popover";
import { Separator } from "@workspace/ui/components//separator";
import { Textarea } from "@workspace/ui/components//textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown, Save, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { formSchema, type JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { getAllCompanies } from "@/lib/queries/companies";
import { zodv4Resolver } from "@/utils/zod-v4-resolver";
import ContactsSection from "./contacts-section";
import DateTimePicker from "./deadline-picker";
import DescriptionEditor from "./description-editor";

export default function EventForm({
	onPrimarySubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
	defaultValues,
}: {
	onPrimarySubmitAction: (values: JobListingFormValues) => void;
	onSecondarySubmitAction: (values: JobListingFormValues) => void;
	onTertiarySubmitAction?: (values: JobListingFormValues) => void;
	defaultValues: JobListingFormValues;
}) {
	const form = useForm<JobListingFormValues>({
		resolver: zodv4Resolver(formSchema),
		defaultValues: defaultValues,
	});

	const [openCompanies, setOpenCompanies] = useState(false);
	const [companyValue, setCompanyValue] = useState(form.watch("company").company_name);

	const { data: companies } = useQuery({
		queryKey: ["companies"],
		queryFn: getAllCompanies,
	});

	return (
		<Form {...form}>
			<form className='space-y-8'>
				{/* Title */}
				<FormField
					control={form.control}
					name='title'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Tittel</FormLabel>
							<FormControl>
								<Input placeholder='Stillingsanonse med Navet' {...field} />
							</FormControl>
							<FormDescription>Dette er hva stillingsannonsen skal hete.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Separator />

				{/* Company, deadline and listing type */}
				<div className='flex gap-4'>
					<FormField
						control={form.control}
						name='company'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Velg arrangerende bedrift</FormLabel>
								<Popover open={openCompanies} onOpenChange={setOpenCompanies}>
									<PopoverTrigger asChild>
										<Button
											variant='outline'
											aria-expanded={openCompanies}
											className='justify-between'
										>
											{companyValue
												? companies?.find((company) => company.company_name === companyValue)
														?.company_name
												: "Velg en bedrift..."}
											<ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
										</Button>
									</PopoverTrigger>
									<PopoverContent className='w-[200px] p-0' align='start'>
										<Command>
											<CommandInput placeholder='Søk etter bedrift...' />
											<CommandList>
												<CommandEmpty>Fant ingen bedrift(er).</CommandEmpty>
												<CommandGroup>
													{companies?.map((company) => (
														<CommandItem
															key={company.company_id}
															value={company.company_name}
															onSelect={(currentValue) => {
																setCompanyValue(currentValue === companyValue ? "" : currentValue);
																field.onChange(company);
																setOpenCompanies(false);
															}}
														>
															<Check
																className={cn(
																	"mr-2 h-4 w-4",
																	companyValue === company.company_name
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
															{company.company_name}
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
								<FormDescription>
									Velg hvilken bedrift annonsen skal være knyttet til
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<DateTimePicker
						form={form}
						label='Dato og tid for annonsen sin deadline'
						description='Velg dato og tid for når annonsen løper ut'
					/>

					<FormField
						control={form.control}
						name='type'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Type</FormLabel>
								<FormControl>
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger>
											<SelectValue placeholder='Velg type' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='Fulltid'>Fulltid</SelectItem>
											<SelectItem value='Deltid'>Deltid</SelectItem>
											<SelectItem value='Internship'>Internship</SelectItem>
											<SelectItem value='Sommerjobb'>Sommerjobb</SelectItem>
										</SelectContent>
									</Select>
								</FormControl>
								<FormDescription>Velg type av stilling.</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<Separator />

				{/* Teaser */}
				<FormField
					control={form.control}
					name='teaser'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Teaser</FormLabel>
							<FormControl>
								<Textarea placeholder='eks. Har du lyst til å jobbe med Navet?' {...field} />
							</FormControl>
							<FormDescription>Dette er en liten teaser av stillingsannonsen.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Description */}
				<DescriptionEditor form={form} />
				<Separator />

				{/* Contacts */}
				<ContactsSection
					control={form.control}
					contacts={form.watch("contacts")}
					onContactsChangeAction={(contacts) => form.setValue("contacts", contacts)}
				/>
				<Separator />

				{/* Application URL */}
				<FormField
					control={form.control}
					name='applicationUrl'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Ansøkningslenke</FormLabel>
							<FormControl>
								<Input placeholder='eks. https://ifinavet.no/ny-intern' {...field} />
							</FormControl>
							<FormDescription>Legg inn lenken til stillingsannonsen.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Submit form */}
				<div className='mb-4 flex gap-4'>
					<Button
						type='button'
						disabled={form.formState.isSubmitting}
						onClick={form.handleSubmit(onPrimarySubmitAction)}
					>
						<Send /> {form.formState.isSubmitting ? "Jobber..." : "Lagre og publiser"}
					</Button>
					<Button
						type='button'
						disabled={form.formState.isSubmitting}
						variant='secondary'
						onClick={form.handleSubmit(onSecondarySubmitAction)}
					>
						<Save /> {form.formState.isSubmitting ? "Jobber..." : "Lagre"}
					</Button>
					{onTertiarySubmitAction && (
						<Button
							type='button'
							disabled={form.formState.isSubmitting}
							variant='destructive'
							onClick={form.handleSubmit(onTertiarySubmitAction)}
						>
							<Trash2 /> {form.formState.isSubmitting ? "Jobber..." : "Slett"}
						</Button>
					)}
				</div>
			</form>
		</Form>
	);
}
