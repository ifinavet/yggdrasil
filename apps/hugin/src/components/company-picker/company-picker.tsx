"use client";

import type { api } from "@workspace/backend/convex/api";
import { formatOrgNumber } from "@workspace/shared/semester/orgNumber";
import { Button } from "@workspace/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import type { FunctionReturnType } from "convex/server";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useState } from "react";
import { type RegistryHit, useRegistrySearch } from "./use-registry-search";

// Company-facing copy for the picker, shared by the Hugin order and application forms.
export const companyPickerCopy = {
	placeholder: "Velg bedrift",
	search: "Søk etter bedrift",
	empty: "Fant ingen bedrifter.",
	newCompany: "Finner dere ikke bedriften? Søk i Enhetsregisteret",
	registrySearch: "Søk på navn eller organisasjonsnummer",
	registrySearching: "Søker ...",
	registryEmpty: "Ingen treff i Enhetsregisteret.",
	registryTooShort: "Skriv minst to tegn.",
	blocked: {
		deleted: "Slettet fra registeret. Kan ikke velges.",
		bankrupt: "Konkurs. Kan ikke velges.",
		liquidation: "Under avvikling. Kan ikke velges.",
	} satisfies Record<NonNullable<RegistryHit["blockedReason"]>, string>,
	registryRetry: "Prøv igjen",
	backToList: "Velg fra listen i stedet",
} as const;

/** «924 773 189 · AS · OSLO»: the organization number and what else is known about the company. */
export function hitMeta(hit: {
	orgNumber: string;
	organizationForm?: string;
	city?: string;
}): string {
	return [formatOrgNumber(hit.orgNumber), hit.organizationForm, hit.city]
		.filter(Boolean)
		.join(" · ");
}

export type CompanyOption = FunctionReturnType<typeof api.companies.queries.pickerOptions>[number];

/** A company Navet already has, or one found in Enhetsregisteret. */
export type PickedCompany =
	| { kind: "existing"; company: CompanyOption }
	| { kind: "registry"; hit: RegistryHit };

/**
 * A combobox over the companies Navet has, with a search in Enhetsregisteret for a company that is
 * not on the list. Blocked registry companies are listed but cannot be chosen.
 */
export function CompanyPicker({
	id,
	selectedName,
	selectedId,
	companies,
	invalid,
	describedBy,
	onChange,
}: Readonly<{
	id: string;
	/** The name on the button, or "" while nothing is picked. */
	selectedName: string;
	/** The listed company that is picked, if any. */
	selectedId?: string;
	companies: readonly CompanyOption[];
	invalid: boolean;
	describedBy?: string;
	onChange: (company: PickedCompany) => void;
}>) {
	const [open, setOpen] = useState(false);
	const [registryMode, setRegistryMode] = useState(false);

	const choose = (company: PickedCompany) => {
		onChange(company);
		setOpen(false);
		setRegistryMode(false);
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setRegistryMode(false);
			}}
		>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-invalid={invalid}
					aria-describedby={describedBy}
					className="w-full justify-between font-normal aria-invalid:border-destructive"
				>
					<span className={selectedName ? "truncate" : "truncate text-muted-foreground"}>
						{selectedName || companyPickerCopy.placeholder}
					</span>
					<ChevronsUpDown className="size-4 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
				{registryMode ? (
					<RegistrySearch
						onBack={() => setRegistryMode(false)}
						onSelect={(hit) => choose({ kind: "registry", hit })}
					/>
				) : (
					<Command>
						<CommandInput placeholder={companyPickerCopy.search} />
						<CommandList>
							<CommandEmpty>{companyPickerCopy.empty}</CommandEmpty>
							<CommandGroup>
								{companies.map((company) => (
									<CommandItem
										key={company._id}
										value={`${company.name} ${company._id}`}
										onSelect={() => choose({ kind: "existing", company })}
									>
										<Check className={selectedId === company._id ? "size-4" : "size-4 opacity-0"} />
										{company.name}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
						<div className="border-t p-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="w-full justify-start"
								onClick={() => setRegistryMode(true)}
							>
								<Search className="size-4" />
								{companyPickerCopy.newCompany}
							</Button>
						</div>
					</Command>
				)}
			</PopoverContent>
		</Popover>
	);
}

function RegistrySearch({
	onBack,
	onSelect,
}: Readonly<{ onBack: () => void; onSelect: (hit: RegistryHit) => void }>) {
	const [query, setQuery] = useState("");
	const { search: state, retry } = useRegistrySearch(query.trim());

	return (
		<Command shouldFilter={false}>
			<CommandInput
				autoFocus
				placeholder={companyPickerCopy.registrySearch}
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList>
				{state.status === "idle" && (
					<p className="px-3 py-4 text-muted-foreground text-sm">
						{companyPickerCopy.registryTooShort}
					</p>
				)}
				{state.status === "searching" && (
					<p className="px-3 py-4 text-muted-foreground text-sm">
						{companyPickerCopy.registrySearching}
					</p>
				)}
				{state.status === "error" && (
					<div className="flex flex-col items-start gap-2 px-3 py-4">
						<p role="alert" className="text-destructive text-sm">
							{state.message}
						</p>
						<Button type="button" variant="outline" size="sm" onClick={retry}>
							{companyPickerCopy.registryRetry}
						</Button>
					</div>
				)}
				{state.status === "done" && state.hits.length === 0 && (
					<p className="px-3 py-4 text-muted-foreground text-sm">
						{companyPickerCopy.registryEmpty}
					</p>
				)}
				{state.status === "done" && state.hits.length > 0 && (
					<CommandGroup>
						{state.hits.map((hit) => (
							<CommandItem
								key={hit.orgNumber}
								value={hit.orgNumber}
								disabled={hit.blockedReason !== undefined}
								onSelect={() => onSelect(hit)}
							>
								<div className="flex min-w-0 flex-col">
									<span className="truncate">{hit.name}</span>
									<span className="text-muted-foreground text-xs">
										{[
											hitMeta(hit),
											hit.blockedReason && companyPickerCopy.blocked[hit.blockedReason],
										]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
			<div className="border-t p-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="w-full justify-start"
					onClick={onBack}
				>
					{companyPickerCopy.backToList}
				</Button>
			</div>
		</Command>
	);
}
