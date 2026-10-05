import { DEGREE_YEARS, DEGREES } from "@workspace/shared/constants";
import { DAY_MS } from "@workspace/shared/time";
import type { Doc } from "../_generated/dataModel";

type Student = Pick<Doc<"students">, "_id" | "degree" | "year" | "studyProgram">;
type KeyOf = (student: Student) => string | null;

function countBy(students: readonly Student[], keyOf: KeyOf) {
	const counts = new Map<string, number>();
	for (const student of students) {
		const key = keyOf(student);
		if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

function tally(students: readonly Student[], keyOf: (student: Student) => string) {
	const tallies = new Map<string, { student: Student; count: number }>();
	for (const student of students) {
		const key = keyOf(student);
		const entry = tallies.get(key);
		if (entry) entry.count += 1;
		else tallies.set(key, { student, count: 1 });
	}
	return [...tallies];
}

function shareOf(counts: Map<string, number>, total: number, key: string) {
	return total === 0 ? 0 : (counts.get(key) ?? 0) / total;
}

export function uniqueStudents(students: readonly Student[]) {
	return [...new Map(students.map((student) => [student._id, student])).values()];
}

function reachOf(registrants: readonly Student[], cohortSizes: Map<string, number>, key: string) {
	const size = cohortSizes.get(key) ?? 0;
	return size === 0 ? 0 : Math.min(1, (countBy(registrants, cohortOf).get(key) ?? 0) / size);
}

export function withStudyYear<T extends Student & Pick<Doc<"students">, "graduatedAt">>(
	students: readonly T[],
	now: number,
) {
	return students.map((student) =>
		student.graduatedAt === undefined
			? student
			: {
					...student,
					year:
						DEGREE_YEARS[student.degree].last +
						1 +
						Math.floor((now - student.graduatedAt) / (365 * DAY_MS)),
				},
	);
}

type Cohort = { degree: Student["degree"]; year: number | null; rank: number };

export function cohortGroupOf({ degree, year }: Pick<Student, "degree" | "year">): Cohort | null {
	const { first, last } = DEGREE_YEARS[degree];
	if (degree === DEGREES.phd || year < first || year > last) return null;
	return degree === DEGREES.aarsstudium
		? { degree, year: null, rank: DEGREE_YEARS[DEGREES.master].last + 1 }
		: { degree, year, rank: year };
}

function labelOf({ degree, year }: Cohort) {
	return year === null ? degree : `${degree} ${year}. år`;
}

function codeOf({ degree, year }: Cohort) {
	return `${degree.charAt(0)}${year ?? ""}`;
}

function hasCohort(student: Student) {
	return cohortGroupOf(student) !== null;
}

type GroupOf = (student: Pick<Student, "degree" | "year">) => Cohort | null;

export function programCohortGroupOf(student: Pick<Student, "degree" | "year">) {
	const cohort = cohortGroupOf(student);
	return cohort?.degree === DEGREES.aarsstudium
		? cohortGroupOf({ degree: DEGREES.bachelor, year: student.year })
		: cohort;
}

function labelledBy(groupOf: GroupOf) {
	return (student: Pick<Student, "degree" | "year">) => {
		const cohort = groupOf(student);
		return cohort && labelOf(cohort);
	};
}

export const cohortOf = labelledBy(cohortGroupOf);
const programCohortOf = labelledBy(programCohortGroupOf);

function cohortsOf(students: readonly Student[], groupOf: GroupOf) {
	const cohorts = new Map<string, { label: string; count: number; cohort: Cohort }>();
	for (const student of students) {
		const cohort = groupOf(student);
		if (!cohort) continue;
		const label = labelOf(cohort);
		const entry = cohorts.get(label);
		if (entry) entry.count += 1;
		else cohorts.set(label, { label, count: 1, cohort });
	}
	return [...cohorts.values()].sort((a, b) => a.cohort.rank - b.cohort.rank);
}

function programOf({ studyProgram }: Student) {
	return studyProgram;
}

function cohortSizes(population: readonly Student[]) {
	const keyOf = ({ degree, year }: Pick<Student, "degree" | "year">) => `${degree}:${year}`;
	const counts = countBy(population, keyOf);
	const sizes = new Map<string, number>();
	for (const [, { student, count }] of tally(population, keyOf)) {
		const label = cohortOf(student);
		if (label === null) continue;
		sizes.set(
			label,
			Math.max(count, counts.get(keyOf({ ...student, year: student.year + 1 })) ?? 0),
		);
	}
	return sizes;
}

function backdate(students: readonly Student[], years: number) {
	return students.map((student) => ({ ...student, year: student.year - years }));
}

function withoutPhd(students: readonly Student[]) {
	return students.filter(({ degree }) => degree !== "PhD");
}

export function audienceOf(
	allRegistrants: readonly Student[],
	allPopulation: readonly Student[],
	allPreviousRegistrants: readonly Student[] | null = null,
	yearsSincePrevious = 0,
) {
	const registrants = withoutPhd(allRegistrants);
	const population = withoutPhd(allPopulation);
	const previousRegistrants = allPreviousRegistrants && withoutPhd(allPreviousRegistrants);
	const reached = uniqueStudents(registrants);
	const previous = previousRegistrants && backdate(previousRegistrants, yearsSincePrevious);
	const previousReached = previous && uniqueStudents(previous);
	const current = population.filter(hasCohort);
	const populationCohorts = cohortSizes(population);
	const previousPopulationCohorts = cohortSizes(backdate(population, yearsSincePrevious));

	const shareRow = (
		keyOf: KeyOf,
		base: readonly Student[],
		previousBase: readonly Student[] | null,
	) => {
		const populationCounts = countBy(current, keyOf);
		const previousCounts = previousBase && countBy(previousBase, keyOf);
		return (label: string, registrations: number) => {
			const share = base.length === 0 ? 0 : registrations / base.length;
			return {
				label,
				registrations,
				share,
				populationShare: shareOf(populationCounts, current.length, label),
				change: previousCounts
					? share - shareOf(previousCounts, (previousBase as readonly Student[]).length, label)
					: null,
			};
		};
	};

	const cohortRow = shareRow(
		cohortOf,
		registrants.filter(hasCohort),
		previous?.filter(hasCohort) ?? null,
	);
	const groups = [...population, ...registrants, ...(previous ?? [])];
	const counts = countBy(registrants, cohortOf);
	const cohorts = cohortsOf(groups, cohortGroupOf).map(({ label, cohort }) => ({
		...cohortRow(label, counts.get(label) ?? 0),
		degree: cohort.degree,
		year: cohort.year,
		code: codeOf(cohort),
		reach: reachOf(reached, populationCohorts, label),
		previousReach: previousReached && reachOf(previousReached, previousPopulationCohorts, label),
	}));
	const programCohorts = cohortsOf(groups, programCohortGroupOf).map(({ label, cohort }) => ({
		label,
		code: codeOf(cohort),
	}));

	const programRow = shareRow(programOf, registrants, previous);
	const programCounts = countBy(registrants, programOf);
	const programs = tally(groups, programOf)
		.map(([label, entry]) => [label, { ...entry, count: programCounts.get(label) ?? 0 }] as const)
		.sort(([a, { count: countA }], [b, { count: countB }]) => countB - countA || a.localeCompare(b))
		.map(([label, { count }]) => {
			const byCohort = countBy(
				registrants.filter((student) => student.studyProgram === label),
				programCohortOf,
			);
			return {
				...programRow(label, count),
				byCohort: programCohorts.map((cohort) => byCohort.get(cohort.label) ?? 0),
			};
		});

	return { total: registrants.length, reached: reached.length, cohorts, programCohorts, programs };
}
