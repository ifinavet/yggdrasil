import { defaultApplicationSemester, type SemesterRef } from "@workspace/shared/time";

export function homeApplySemester<T extends SemesterRef & { applicationDeadline: string }>(
	today: string,
	open: readonly T[],
): T | null {
	const semester = defaultApplicationSemester(today, open);
	if (!semester || semester.applicationDeadline < today) return null;
	return semester;
}
