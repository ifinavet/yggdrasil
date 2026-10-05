"use client";
import { STUDY_PROGRAMS as programs, STUDY_YEARS } from "@workspace/shared/constants";
import { SearchField } from "@workspace/ui/components/search-field";
import { SearchSelect } from "@workspace/ui/components/search-select";

export function CandidateFilters({
	query,
	setQuery,
	program,
	setProgram,
	year,
	setYear,
}: Readonly<{
	query: string;
	setQuery: (value: string) => void;
	program: string;
	setProgram: (value: string) => void;
	year: string;
	setYear: (value: string) => void;
}>) {
	return (
		<div className="admissions-filters flex flex-wrap items-center gap-3">
			<SearchField
				value={query}
				onChange={setQuery}
				placeholder="Søk etter kandidat"
				className="sm:w-72"
			/>
			<SearchSelect
				aria-label="Studieprogram"
				className="w-full sm:w-72"
				value={program}
				onChange={(value) => setProgram(value ?? "")}
				items={[
					{ id: "", label: "Alle linjer" },
					...programs.map((program) => ({ id: program, label: program })),
				]}
			/>
			<SearchSelect
				aria-label="Studieår"
				className="w-full sm:w-36"
				value={year}
				onChange={(value) => setYear(value ?? "")}
				items={[
					{ id: "", label: "Alle år" },
					...STUDY_YEARS.map((year) => ({ id: String(year), label: `${year}. år` })),
				]}
			/>
		</div>
	);
}
