import type { RefinementCtx } from "zod";
import { DEGREE_TYPES, DEGREE_YEARS, type Degree, NEXT_DEGREE } from "./degrees";
import { PROGRAM_DEGREES, STUDY_PROGRAMS, type StudyProgram } from "./programs";

export function isStudyProgram(program: string): program is StudyProgram {
	return (STUDY_PROGRAMS as readonly string[]).includes(program);
}

export function degreesFor(program: string): readonly Degree[] {
	return isStudyProgram(program) ? PROGRAM_DEGREES[program] : DEGREE_TYPES;
}

export function fittingDegree(program: string, degree: Degree) {
	const allowed = degreesFor(program);
	return allowed.includes(degree) ? degree : (allowed[0] as Degree);
}

export function fittingYear(degree: Degree, year: number) {
	const { first, last } = DEGREE_YEARS[degree];
	return Math.min(Math.max(year, first), last);
}

export function yearsFor(degree: Degree) {
	const { first, last } = DEGREE_YEARS[degree];
	return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export type StudentProfile = { studyProgram: string; degree: Degree; year: number };

export function nextStudy({ studyProgram, degree, year }: StudentProfile): StudentProfile {
	const next = fittingDegree(studyProgram, NEXT_DEGREE[degree] ?? degree);
	return { studyProgram, degree: next, year: fittingYear(next, year + 1) };
}

export function studentProfileIssue({ studyProgram, degree, year }: StudentProfile) {
	if (!isStudyProgram(studyProgram)) {
		return { field: "studyProgram", message: "Velg et studieprogram fra listen." } as const;
	}
	if (!degreesFor(studyProgram).includes(degree)) {
		return { field: "degree", message: `${studyProgram} tilbys ikke som ${degree}.` } as const;
	}
	if (!yearsFor(degree).includes(year)) {
		const { first, last } = DEGREE_YEARS[degree];
		return {
			field: "year",
			message: `År må være mellom ${first} og ${last} for ${degree}.`,
		} as const;
	}
	return null;
}

export function refineStudentProfile(profile: StudentProfile, ctx: RefinementCtx) {
	const issue = studentProfileIssue(profile);
	if (issue) ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
}
