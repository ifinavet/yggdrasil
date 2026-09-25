"use client";

import { type SemesterRef, semesterKey, semesterLabel } from "@workspace/shared/products";
import { SEMESTER_LABEL } from "@workspace/shared/semester/labels";
import { eventSemesterOf } from "@workspace/shared/time";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";

export const ALL_SEMESTERS = "all";

export function currentSemester(): SemesterRef {
	return eventSemesterOf(Date.now());
}

export function currentSemesterKey() {
	return semesterKey(currentSemester());
}

function optionLabel(semester: SemesterRef, currentKey: string) {
	const label = semesterLabel(semester);
	return semesterKey(semester) === currentKey ? `${label} (pågår)` : label;
}

export function SemesterSelect({
	semesters,
	value,
	onChange,
	includeAll = false,
}: Readonly<{
	semesters: readonly SemesterRef[];
	value: string;
	onChange: (key: string) => void;
	includeAll?: boolean;
}>) {
	const currentKey = currentSemesterKey();

	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className="w-[200px]" aria-label={SEMESTER_LABEL}>
				<SelectValue placeholder="Velg et semester" />
			</SelectTrigger>
			<SelectContent>
				{semesters.map((semester) => (
					<SelectItem key={semesterKey(semester)} value={semesterKey(semester)}>
						{optionLabel(semester, currentKey)}
					</SelectItem>
				))}
				{includeAll && <SelectItem value={ALL_SEMESTERS}>Alle semestre</SelectItem>}
			</SelectContent>
		</Select>
	);
}
