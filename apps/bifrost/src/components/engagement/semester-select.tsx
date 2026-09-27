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
import { useState } from "react";
import {
	type SemesterOption,
	semesterLabel,
	semesterValue,
	startedSemesters,
} from "./engagement-format";

export function useSemesterSelect(now: number) {
	const semesters = useQuery(api.events.queries.getPossibleSemesters);
	const [selected, setSelected] = useState<SemesterOption>(() => eventSemesterOf(now));
	const options = semesters ? startedSemesters(semesters, now) : [selected];

	const select = (
		<Select
			value={semesterValue(selected)}
			onValueChange={(value) => {
				const option = options.find((candidate) => semesterValue(candidate) === value);
				if (option) setSelected(option);
			}}
		>
			<SelectTrigger size="sm" aria-label="Semester">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={semesterValue(option)} value={semesterValue(option)}>
						{semesterLabel(option)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	return { selected, select };
}
