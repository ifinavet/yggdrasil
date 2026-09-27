"use client";

import { api } from "@workspace/backend/convex/api";
import { eventSemesterOf } from "@workspace/shared/time";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
	type SemesterOption,
	semesterLabel,
	semesterValue,
	startedSemesters,
} from "./engagement-format";

const ALL_SEMESTERS = "all";

export function useSemesterSelect(now: number, { withAll = false } = {}) {
	const semesters = useQuery(api.events.queries.getPossibleSemesters);
	const [selected, setSelected] = useState<SemesterOption>(() => eventSemesterOf(now));
	const [all, setAll] = useState(false);
	const started = useMemo(
		() => (semesters ? startedSemesters(semesters, now) : null),
		[semesters, now],
	);
	const options = started ?? [selected];

	const select = (
		<Select
			value={all ? ALL_SEMESTERS : semesterValue(selected)}
			onValueChange={(value) => {
				if (value === ALL_SEMESTERS) {
					setAll(true);
					return;
				}
				const option = options.find((candidate) => semesterValue(candidate) === value);
				if (option) {
					setSelected(option);
					setAll(false);
				}
			}}
		>
			<SelectTrigger size="sm" aria-label="Semester">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{withAll && <SelectItem value={ALL_SEMESTERS}>Alle semestre</SelectItem>}
				{options.map((option) => (
					<SelectItem key={semesterValue(option)} value={semesterValue(option)}>
						{semesterLabel(option)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	return { selected, select, all, options: started };
}
