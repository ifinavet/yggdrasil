"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
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
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";

const schema = z.object({
	companyId: z.custom<Id<"companies">>(
		(val) => typeof val === "string",
		"Vennligst velg en bedrift, til å være hovedsamarbeidspartner",
	),
});

export default function UpdateMainSponsorForm({
	companyId,
}: Readonly<{ companyId: Id<"companies"> }>) {
	const form = useForm<z.infer<typeof schema>>({
		resolver: zodV4Resolver(schema),
		defaultValues: {
			companyId: companyId || "",
		},
	});

	const [searchInput, setSearchInput] = useState<string>("");

	const companies = useQuery(api.companies.searchByName, { searchQuery: searchInput });

	const updateMainSponsor = useMutation(api.companies.updateMainSponsor);
	const handleUpdateMainSponsor = ({ companyId }: z.infer<typeof schema>) =>
		updateMainSponsor({ companyId }).catch(() =>
			toast.error("Oi! Det oppstod en feil!", {
				description: "Skulle feilen vedvare kontakt webansvarlig.",
			}),
		);

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleUpdateMainSponsor)} className='space-y-6'>
				<FormField
					control={form.control}
					name='companyId'
					render={({ field }) => (
						<FormItem className='flex flex-col'>
							<FormLabel>Endre hovedsamarbeidspartner</FormLabel>
							<FormControl>
								<div className='space-y-2'>
									<Input
										placeholder='Søk eks. ifi-navet'
										type='text'
										onChange={(e) => {
											setSearchInput(e.target.value);
										}}
									/>
									<ScrollArea className='max-h-20'>
										{companies?.map((company) => (
											<Button
												key={company._id}
												type='button'
												variant='ghost'
												onClick={() => field.onChange(company._id)}
												className={`mb-2 flex w-full justify-start ${field.value === company._id
													? "bg-primary text-primary hover:bg-primary/90 dark:text-primary-light-foreground"
													: ""
													}`}
											>
												{company.name}
											</Button>
										))}
									</ScrollArea>
								</div>
							</FormControl>
							<FormDescription>
								Søk og velg en bedrift til å være hovedsamarbeidspartner.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type='submit'>Oppdater hovedsamarbeidspartner</Button>
			</form>
		</Form>
	);
}
