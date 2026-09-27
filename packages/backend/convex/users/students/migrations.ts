import { DEGREE_YEARS, DEGREES, fittingDegree } from "@workspace/shared/constants";
import type { Doc } from "../../_generated/dataModel";
import { migrations } from "../../migrations";

type Student = Pick<Doc<"students">, "studyProgram" | "degree" | "year" | "graduatedAt">;

function lastYearUpdate(now: number, yearsBack: number) {
	const date = new Date(now);
	const year = date.getUTCMonth() >= 7 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
	return Date.UTC(year - yearsBack, 7, 1);
}

export function normalizedStudent(student: Student, now: number) {
	if (student.graduatedAt !== undefined) return;
	const degree = fittingDegree(student.studyProgram, student.degree);
	const { first, last } = DEGREE_YEARS[degree];
	const year =
		degree === DEGREES.master && student.year < first ? student.year + first - 1 : student.year;
	const fields =
		year > last
			? { degree, year: last, graduatedAt: lastYearUpdate(now, year - last - 1) }
			: { degree, year };
	const changed =
		fields.degree !== student.degree || fields.year !== student.year || "graduatedAt" in fields;
	return changed ? fields : undefined;
}

export const normalizeStudents = migrations.define({
	table: "students",
	migrateOne: (_ctx, student) => normalizedStudent(student, Date.now()),
});
