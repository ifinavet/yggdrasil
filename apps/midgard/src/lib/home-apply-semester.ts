import { defaultApplicationSemester, type SemesterRef } from "@workspace/shared/time";
import { differenceInCalendarDays, parseISO } from "date-fns";

export function homeApplySemester<T extends SemesterRef & { applicationDeadline: string }>(
	today: string,
	open: readonly T[],
): T | null {
	const semester = defaultApplicationSemester(today, open);
	if (!semester || semester.applicationDeadline < today) return null;
	return semester;
}

export function deadlineCountdown(today: string, deadline: string): string {
	const days = differenceInCalendarDays(parseISO(deadline), parseISO(today));
	if (days <= 0) return "Siste dag i dag";
	return days === 1 ? "1 dag igjen" : `${days} dager igjen`;
}
