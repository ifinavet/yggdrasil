"use client";

import { api } from "@workspace/backend/convex/api";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components/command";
import { Note } from "@workspace/ui/components/note";
import { cn } from "@workspace/ui/lib/utils";
import { useAction } from "convex/react";
import { Check, CircleAlert, LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { secondaryButtonClass } from "@/components/form-buttons";
import { ERROR_BORDER, ERROR_TEXT, inputClass, linkClass } from "@/components/form-controls";
import type { ChosenCompany, RegistryHit } from "@/lib/company-application";
import { formatOrgNumber, placeName } from "@/lib/company-application-format";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import { companyErrorMessage } from "@/lib/company-error-message";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

type SearchState =
	| { status: "idle" }
	| { status: "searching" }
	| { status: "done"; hits: RegistryHit[] }
	| { status: "error"; message: string };

/** The query highlighted in a company name, as in «<mark>FJORDKODE</mark> AS». */
function Highlighted({
	name,
	query,
	muted,
}: Readonly<{ name: string; query: string; muted: boolean }>) {
	const index = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
	if (index === -1) return name;

	return (
		<>
			{name.slice(0, index)}
			<mark
				className={cn(
					"bg-transparent underline decoration-2 underline-offset-[3px]",
					muted ? "text-inherit" : "text-primary dark:text-primary-foreground",
				)}
			>
				{name.slice(index, index + query.length)}
			</mark>
			{name.slice(index + query.length)}
		</>
	);
}

/** What the live region reads out about the search: that it runs, or how it went. */
function searchStatusText(search: SearchState): string {
	if (search.status === "searching") return COPY.company.searching;
	if (search.status !== "done") return "";
	if (search.hits.length === 0) return COPY.company.noHits;
	return COPY.company.hitCount(search.hits.length);
}

function hitMeta(hit: RegistryHit): string {
	return [formatOrgNumber(hit.orgNumber), hit.organizationForm, hit.city && placeName(hit.city)]
		.filter(Boolean)
		.join(" · ");
}

function chosenFrom(hit: RegistryHit): ChosenCompany {
	return {
		orgNumber: hit.orgNumber,
		name: hit.name,
		organizationForm: hit.organizationForm,
		...(hit.city ? { city: hit.city } : {}),
	};
}

/** Searches Enhetsregisteret as the company types; only the newest search may show its hits. */
function useRegistrySearch(query: string): { search: SearchState; retry: () => void } {
	const searchCompanies = useAction(api.semesterPlanning.registry.actions.searchCompanies);
	const [search, setSearch] = useState<SearchState>({ status: "idle" });
	const [attempt, setAttempt] = useState(0);
	const latest = useRef(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: attempt re-runs the same search on «Prøv igjen».
	useEffect(() => {
		// Counted before the length check, so a search still running for a longer query is ignored.
		const request = ++latest.current;
		if (query.length < MIN_QUERY_LENGTH) {
			setSearch({ status: "idle" });
			return;
		}

		setSearch({ status: "searching" });
		const timer = window.setTimeout(async () => {
			try {
				const hits = await searchCompanies({ query });
				if (request === latest.current) setSearch({ status: "done", hits });
			} catch (error) {
				if (request === latest.current) {
					setSearch({ status: "error", message: companyErrorMessage(error) });
				}
			}
		}, DEBOUNCE_MS);

		return () => window.clearTimeout(timer);
	}, [query, searchCompanies, attempt]);

	return { search, retry: () => setAttempt((count) => count + 1) };
}

/**
 * A combobox over Enhetsregisteret. There is no free-text company name, so a company can only be
 * picked from the registry. Blocked companies are listed but cannot be chosen.
 */
export function CompanySearch({
	company,
	onChange,
	invalid,
	describedBy,
}: Readonly<{
	company: ChosenCompany | null;
	onChange: (company: ChosenCompany | null) => void;
	invalid: boolean;
	describedBy?: string;
}>) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const trimmed = query.trim();
	const { search, retry } = useRegistrySearch(trimmed);

	if (company) {
		return (
			<ChosenCompanyCard
				company={company}
				onChange={() => {
					onChange(null);
					setQuery("");
					window.setTimeout(() => inputRef.current?.focus(), 0);
				}}
			/>
		);
	}

	const hits = search.status === "done" ? search.hits : [];
	const showList = open && (search.status === "done" || search.status === "searching");
	const failed = invalid || search.status === "error";

	return (
		<div>
			<Command
				shouldFilter={false}
				loop
				label={COPY.company.label}
				className="overflow-visible rounded-none bg-transparent text-foreground"
			>
				<CommandInput
					ref={inputRef}
					value={query}
					onValueChange={(next) => {
						setQuery(next);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setOpen(false)}
					onKeyDown={(event) => {
						if (event.key === "Escape") setOpen(false);
					}}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					enterKeyHint="search"
					icon={
						search.status === "searching" ? (
							<LoaderCircle
								aria-hidden
								className="size-4 flex-none animate-spin text-muted-foreground"
							/>
						) : (
							<Search aria-hidden className="size-4 flex-none text-muted-foreground" />
						)
					}
					wrapperClassName={cn(
						inputClass(failed),
						"flex h-auto items-center gap-2.5 focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_32%,transparent)]",
						failed && ERROR_BORDER,
					)}
					className="h-12 min-w-0 flex-1 rounded-none py-0 text-base placeholder:text-[oklch(0.6_0.012_286)] md:text-[15px]"
				/>

				{showList && (
					<CommandList
						// Keeps focus in the input, so a click on a company is not lost to its blur.
						onMouseDown={(event) => event.preventDefault()}
						className="mt-2 max-h-none overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_30px_-20px_oklch(0.3_0.05_265/0.45)]"
					>
						{search.status === "searching" && hits.length === 0 && (
							<div className="px-[14px] py-3 text-[13.5px] text-muted-foreground">
								{COPY.company.searching}
							</div>
						)}
						{search.status === "done" && (
							<CommandEmpty className="px-[14px] py-3 text-[13.5px] text-muted-foreground">
								{COPY.company.noHits}
							</CommandEmpty>
						)}
						{hits.map((hit) => {
							const blocked = hit.blockedReason !== undefined;
							return (
								<CommandItem
									key={hit.orgNumber}
									value={hit.orgNumber}
									disabled={blocked}
									onSelect={() => {
										onChange(chosenFrom(hit));
										setOpen(false);
									}}
									className={cn(
										"block min-h-11 rounded-none border-border border-t px-[14px] py-3 text-foreground first:border-t-0 data-[selected=true]:bg-primary-light data-[selected=true]:text-foreground data-[disabled=true]:opacity-100 dark:data-[selected=true]:bg-accent",
										blocked ? "cursor-not-allowed" : "cursor-pointer",
									)}
								>
									<div
										className={cn(
											"font-semibold text-[14.5px]",
											blocked && "text-muted-foreground",
										)}
									>
										<Highlighted name={hit.name} query={trimmed} muted={blocked} />
									</div>
									<div className="mt-[3px] text-[12.5px] text-muted-foreground tabular-nums">
										{hitMeta(hit)}
									</div>
									{hit.blockedReason && (
										<div
											className={cn(
												"mt-1 inline-flex items-center gap-[5px] font-semibold text-[12px]",
												ERROR_TEXT,
											)}
										>
											<CircleAlert aria-hidden className="size-[13px]" />
											{COPY.blocked[hit.blockedReason]}
										</div>
									)}
								</CommandItem>
							);
						})}
						{hits.length > 0 && (
							<div className="bg-muted px-[14px] py-3 text-[12.5px] text-muted-foreground">
								{COPY.company.hitCount(hits.length)}
							</div>
						)}
					</CommandList>
				)}
			</Command>

			<span className="sr-only" role="status" aria-live="polite">
				{searchStatusText(search)}
			</span>

			{search.status === "error" && (
				<>
					<Note tone="bad" role="alert" className="mt-2.5">
						{search.message} {COPY.company.draftSaved}
					</Note>
					<button
						type="button"
						onClick={retry}
						className={cn(secondaryButtonClass, "mt-3 w-auto px-5")}
					>
						{COPY.company.retry}
					</button>
				</>
			)}
		</div>
	);
}

/** The picked company, with its registry details and a way to pick another. */
function ChosenCompanyCard({
	company,
	onChange,
}: Readonly<{ company: ChosenCompany; onChange: () => void }>) {
	const { facts } = COPY.company;
	return (
		<div className="rounded-[14px] border border-border bg-card p-4">
			<div className="flex items-start justify-between gap-2.5">
				<div className="min-w-0">
					<p className="m-0 font-bold text-[16px] text-primary tracking-[-0.005em] dark:text-primary-foreground">
						{company.name}
					</p>
					<p className="m-0 mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
						<Check aria-hidden className="size-[13px] text-success" strokeWidth={2.6} />
						{COPY.company.source}
					</p>
				</div>
				<button
					type="button"
					onClick={onChange}
					className={cn(
						linkClass,
						"-mt-2.5 -mr-2 min-h-11 min-w-11 whitespace-nowrap rounded-lg px-2 font-semibold text-[13.5px] focus-visible:outline-3 focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)]",
					)}
					aria-label={COPY.company.changeLabel}
				>
					{COPY.company.change}
				</button>
			</div>
			<dl className="m-0 mt-3 grid grid-cols-[100px_1fr] gap-y-[7px] text-[13.5px]">
				<dt className="text-muted-foreground">{facts.orgNumber}</dt>
				<dd className="m-0 tabular-nums">{formatOrgNumber(company.orgNumber)}</dd>
				<dt className="text-muted-foreground">{facts.organizationForm}</dt>
				<dd className="m-0">{company.organizationForm}</dd>
				{company.city && (
					<>
						<dt className="text-muted-foreground">{facts.city}</dt>
						<dd className="m-0">{placeName(company.city)}</dd>
					</>
				)}
			</dl>
		</div>
	);
}
