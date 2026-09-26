"use client";

import type { api } from "@workspace/backend/convex/api";
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
import { useRegistrySearch } from "@/components/company-application/use-registry-search";
import type { RegistryHit } from "@/lib/company-application";
import { hitMeta } from "@/lib/company-application-format";
import { companyCopy } from "@/lib/job-listing-order/copy";
import { type CompanyValues, emptyCompany } from "@/lib/job-listing-order/form-values";

type CompanyOption = FunctionReturnType<typeof api.jobListingOrders.form.companies>[number];

function selectedName(value: CompanyValues, companies: readonly CompanyOption[]) {
	if (value.kind === "new") return value.displayName || value.registryName;
	return companies.find((company) => company._id === value.companyId)?.name ?? "";
}

export function CompanyPicker({
	id,
	value,
	companies,
	invalid,
	onChange,
}: Readonly<{
	id: string;
	value: CompanyValues;
	companies: readonly CompanyOption[];
	invalid: boolean;
	onChange: (company: CompanyValues) => void;
}>) {
	const [open, setOpen] = useState(false);
	const [registryMode, setRegistryMode] = useState(false);
	const name = selectedName(value, companies);

	const choose = (company: CompanyValues) => {
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
					className="w-full justify-between font-normal aria-invalid:border-destructive"
				>
					<span className={name ? "truncate" : "truncate text-muted-foreground"}>
						{name || companyCopy.placeholder}
					</span>
					<ChevronsUpDown className="size-4 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
				{registryMode ? (
					<RegistrySearch
						onBack={() => setRegistryMode(false)}
						onSelect={(hit) =>
							choose({
								...emptyCompany,
								kind: "new",
								orgNumber: hit.orgNumber,
								registryName: hit.name,
								displayName: hit.name,
							})
						}
					/>
				) : (
					<Command>
						<CommandInput placeholder={companyCopy.search} />
						<CommandList>
							<CommandEmpty>{companyCopy.empty}</CommandEmpty>
							<CommandGroup>
								{companies.map((company) => (
									<CommandItem
										key={company._id}
										value={`${company.name} ${company._id}`}
										onSelect={() => choose({ ...emptyCompany, companyId: company._id })}
									>
										<Check
											className={
												value.kind === "existing" && value.companyId === company._id
													? "size-4"
													: "size-4 opacity-0"
											}
										/>
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
								{companyCopy.newCompany}
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
	const { search: state } = useRegistrySearch(query.trim());

	return (
		<Command shouldFilter={false}>
			<CommandInput
				autoFocus
				placeholder={companyCopy.registrySearch}
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList>
				{state.status === "idle" && (
					<p className="px-3 py-4 text-muted-foreground text-sm">{companyCopy.registryTooShort}</p>
				)}
				{state.status === "searching" && (
					<p className="px-3 py-4 text-muted-foreground text-sm">{companyCopy.registrySearching}</p>
				)}
				{state.status === "error" && (
					<p className="px-3 py-4 text-destructive text-sm">{state.message}</p>
				)}
				{state.status === "done" && state.hits.length === 0 && (
					<p className="px-3 py-4 text-muted-foreground text-sm">{companyCopy.registryEmpty}</p>
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
										{[hitMeta(hit), hit.blockedReason && companyCopy.registryBlocked]
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
					{companyCopy.backToList}
				</Button>
			</div>
		</Command>
	);
}
