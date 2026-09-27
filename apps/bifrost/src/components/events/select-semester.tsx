"use client";

import type { api } from "@workspace/backend/convex/api";
import { eventSemesterOf, isEventSemester } from "@workspace/shared/time";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components//select";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useSelectedEventsStore } from "@/lib/stores/selected-events";

export default function SelectSemester(
	props: Readonly<{
		preloadedPossibleSemesters: Preloaded<typeof api.events.queries.getPossibleSemesters>;
	}>,
) {
	const router = useRouter();
	const path = usePathname();
	const searchParams = useSearchParams();

	const clearEvents = useSelectedEventsStore((state) => state.clearEvents);

	const semesters = usePreloadedQuery(props.preloadedPossibleSemesters);

	const updateSemester = useCallback(
		(semester: string, year: number) => {
			const params = new URLSearchParams(searchParams);
			params.set("semester", semester);
			params.set("year", year.toString());
			return params.toString();
		},
		[searchParams],
	);

	const current = eventSemesterOf(Date.now());
	const year = Number.parseInt(searchParams.get("year") ?? "", 10) || current.year;
	const selectedSemester = searchParams.get("semester");
	const semester = isEventSemester(selectedSemester) ? selectedSemester : current.semester;

	return (
		<Select
			defaultValue={`${year} ${semester}`}
			onValueChange={(value) => {
				const parts = value.split(" ");
				const semesterPart = parts[1];
				const yearPart = parts[0];

				clearEvents();

				if (semesterPart && yearPart) {
					router.push(`${path}?${updateSemester(semesterPart, Number.parseInt(yearPart, 10))}`);
				}
			}}
		>
			<SelectTrigger>
				<SelectValue placeholder="Velg et semester" />
			</SelectTrigger>
			<SelectContent>
				{semesters?.map(({ year, semester }) => (
					<SelectItem key={year + semester} value={`${year} ${semester}`}>
						{year} {semester}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
