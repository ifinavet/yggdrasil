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

export function cohortOf({ degree, year }: Pick<Student, "degree" | "year">) {
	return `${degree} ${year}. år`;
}

function programOf({ studyProgram }: Student) {
	return studyProgram;
}

export function audienceOf(
	registrants: readonly Student[],
	population: readonly Student[],
	previous: readonly Student[] | null = null,
) {
	const reached = uniqueStudents(registrants);
	const previousReached = previous && uniqueStudents(previous);
	const populationCohorts = countBy(population, cohortOf);

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
	const cohorts = tally(registrants, cohortOf)
		.sort(
			([, a], [, b]) =>
				a.student.year - b.student.year || a.student.degree.localeCompare(b.student.degree),
		)
		.map(([label, { student, count }]) => ({
			...cohortRow(label, count),
			degree: student.degree,
			year: student.year,
			reach: reachOf(reached, populationCohorts, label),
			previousReach: previousReached && reachOf(previousReached, populationCohorts, label),
		}));
	const cohortLabels = cohorts.map(({ label }) => label);

	const programRow = shareRow(programOf);
	const programs = tally(registrants, programOf)
		.sort(([a, { count: countA }], [b, { count: countB }]) => countB - countA || a.localeCompare(b))
		.slice(0, TOP_PROGRAMS)
		.map(([label, { count }]) => {
			const byCohort = countBy(
				registrants.filter((student) => student.studyProgram === label),
				cohortOf,
			);
			return {
				...programRow(label, count),
				byCohort: cohortLabels.map((cohort) => byCohort.get(cohort) ?? 0),
			};
		});

	return { total: registrants.length, reached: reached.length, cohorts, programs };
}
