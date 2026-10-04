"use client";
import { STUDY_PROGRAMS as programs, STUDY_YEARS } from "@workspace/shared/constants";
import { SearchField } from "@workspace/ui/components/search-field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";

export function CandidateFilters({
	query,
	setQuery,
	program,
	setProgram,
	year,
	setYear,
}: {
	query: string;
	setQuery: (value: string) => void;
	program: string;
	setProgram: (value: string) => void;
	year: string;
	setYear: (value: string) => void;
}) {
	return (
		<div className="admissions-filters">
			<SearchField
				value={query}
				onChange={setQuery}
				placeholder="Søk etter kandidat"
				className="sm:w-72"
			/>
			<Select
				value={program || "all"}
				onValueChange={(value) => setProgram(value === "all" ? "" : value)}
			>
				<SelectTrigger aria-label="Studieprogram" className="w-full sm:w-72">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Alle linjer</SelectItem>
					{programs.map((p) => (
						<SelectItem key={p} value={p}>
							{p}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={year || "all"}
				onValueChange={(value) => setYear(value === "all" ? "" : value)}
			>
				<SelectTrigger aria-label="Studieår" className="w-full sm:w-36">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Alle år</SelectItem>
					{STUDY_YEARS.map((y) => (
						<SelectItem key={y} value={String(y)}>
							{y}. år
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
