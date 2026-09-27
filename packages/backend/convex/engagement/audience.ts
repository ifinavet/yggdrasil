import type { Doc } from "../_generated/dataModel";

export const TOP_PROGRAMS = 8;

type Student = Pick<Doc<"students">, "_id" | "degree" | "year" | "studyProgram">;
type KeyOf = (student: Student) => string;

function countBy(students: readonly Student[], keyOf: KeyOf) {
	const counts = new Map<string, number>();
	for (const student of students) {
		const key = keyOf(student);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

function tally(students: readonly Student[], keyOf: KeyOf) {
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

function uniqueStudents(students: readonly Student[]) {
	return [...new Map(students.map((student) => [student._id, student])).values()];
}

function reachOf(
	registrants: readonly Student[],
	populationCounts: Map<string, number>,
	key: string,
) {
	const population = populationCounts.get(key) ?? 0;
	return population === 0
		? 0
		: Math.min(1, (countBy(registrants, cohortOf).get(key) ?? 0) / population);
}

type Cohort = { degree: Student["degree"]; year: number | null; rank: number };

export function cohortGroupOf({ degree, year }: Pick<Student, "degree" | "year">): Cohort | null {
	if (year < 1) return null;
	switch (degree) {
		case "Bachelor":
			return { degree, year: Math.min(year, 3), rank: Math.min(year, 3) };
		case "Master": {
			const masterYear = year === 2 || year === 5 ? 5 : 4;
			return { degree, year: masterYear, rank: masterYear };
		}
		case "Årsstudium":
			return { degree, year: null, rank: 6 };
		case "PhD":
			return null;
	}
}

function labelOf({ degree, year }: Cohort) {
	return year === null ? degree : `${degree} ${year}. år`;
}

function codeOf({ degree, year }: Cohort) {
	return `${degree.charAt(0)}${year ?? ""}`;
}

type GroupOf = (student: Pick<Student, "degree" | "year">) => Cohort | null;

export function programCohortGroupOf({ degree, year }: Pick<Student, "degree" | "year">) {
	return degree === "Årsstudium"
		? cohortGroupOf({ degree: "Bachelor", year: Math.min(year, 2) })
		: cohortGroupOf({ degree, year });
}

function labelledBy(groupOf: GroupOf) {
	return (student: Pick<Student, "degree" | "year">) => {
		const cohort = groupOf(student);
		return cohort ? labelOf(cohort) : "";
	};
}

export const cohortOf = labelledBy(cohortGroupOf);
const programCohortOf = labelledBy(programCohortGroupOf);

function cohortsOf(students: readonly Student[], groupOf: GroupOf) {
	return tally(students, labelledBy(groupOf))
		.flatMap(([label, { student, count }]) => {
			const cohort = groupOf(student);
			return cohort ? [{ label, count, cohort }] : [];
		})
		.sort((a, b) => a.cohort.rank - b.cohort.rank);
}

function programOf({ studyProgram }: Student) {
	return studyProgram;
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
	const populationCohorts = countBy(population, cohortOf);
	const previousPopulationCohorts = countBy(backdate(population, yearsSincePrevious), cohortOf);

	const shareRow = (keyOf: KeyOf) => {
		const populationCounts = countBy(population, keyOf);
		const previousCounts = previous && countBy(previous, keyOf);
		return (label: string, registrations: number) => {
			const share = registrations / registrants.length;
			return {
				label,
				registrations,
				share,
				populationShare: shareOf(populationCounts, population.length, label),
				change: previousCounts
					? share - shareOf(previousCounts, (previous as readonly Student[]).length, label)
					: null,
			};
		};
	};

	const cohortRow = shareRow(cohortOf);
	const cohorts = cohortsOf(registrants, cohortGroupOf).map(({ label, count, cohort }) => ({
		...cohortRow(label, count),
		degree: cohort.degree,
		year: cohort.year,
		code: codeOf(cohort),
		reach: reachOf(reached, populationCohorts, label),
		previousReach: previousReached && reachOf(previousReached, previousPopulationCohorts, label),
	}));
	const programCohorts = cohortsOf(registrants, programCohortGroupOf).map(({ label, cohort }) => ({
		label,
		code: codeOf(cohort),
	}));

	const programRow = shareRow(programOf);
	const programs = tally(registrants, programOf)
		.sort(([a, { count: countA }], [b, { count: countB }]) => countB - countA || a.localeCompare(b))
		.slice(0, TOP_PROGRAMS)
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
