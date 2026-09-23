"use client";

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
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

export type SelectedCompany = {
	readonly name: string;
	readonly id: string;
};

export default function CompanySelectField({
	initialCompanyName,
	onCompanyChange,
	errors,
	isInvalid,
}: Readonly<{
	initialCompanyName: string;
	onCompanyChange: (company: SelectedCompany) => void;
	errors: Array<{ message?: string } | undefined>;
	isInvalid: boolean;
}>) {
	const companies = useQuery(api.companies.queries.getAll);
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [selectedCompanyName, setSelectedCompanyName] = useState(initialCompanyName);

	return (
		<Field className="min-w-0 md:w-full">
			<FieldLabel>Velg arrangerende bedrift</FieldLabel>
			<Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						aria-expanded={isPickerOpen}
						className="justify-between truncate"
					>
						{selectedCompanyName
							? companies?.find((company) => company.name === selectedCompanyName)?.name
							: "Velg en bedrift..."}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-50 p-0" align="start">
					<Command>
						<CommandInput placeholder="Søk etter bedrift..." />
						<CommandList>
							<CommandEmpty>Fant ingen bedrift(er).</CommandEmpty>
							<CommandGroup>
								{companies?.map((company) => (
									<CommandItem
										key={company._id}
										value={company.name}
										onSelect={(pickedName) => {
											setSelectedCompanyName(pickedName === selectedCompanyName ? "" : pickedName);
											onCompanyChange({ name: pickedName, id: company._id });
											setIsPickerOpen(false);
										}}
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												selectedCompanyName === company.name ? "opacity-100" : "opacity-0",
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
			{isInvalid && <FieldError errors={errors} />}
			<FieldDescription>Velg hvilken bedrift annonsen skal være knyttet til</FieldDescription>
		</Field>
	);
}
