import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { audienceOf, cohortGroupOf, cohortOf, TOP_PROGRAMS } from "./audience";

type Student = Pick<Doc<"students">, "_id" | "degree" | "year" | "studyProgram">;

function student(
	id: string,
	degree: Student["degree"],
	year: number,
	studyProgram = "Informatikk",
): Student {
	return { _id: id as Id<"students">, degree, year, studyProgram };
}

const ADA = student("ada", "Bachelor", 1, "Informatikk");
const BO = student("bo", "Bachelor", 1, "Matematikk");
const CY = student("cy", "Master", 4, "Informatikk");
const DI = student("di", "Bachelor", 3, "Informatikk");
const POPULATION = [ADA, BO, CY, DI];

describe("cohortOf", () => {
	it("labels a cohort by degree and year", () => {
		expect(cohortOf({ degree: "Bachelor", year: 2 })).toBe("Bachelor 2. år");
	});

	it("folds late bachelor years into the third year", () => {
		expect(cohortOf({ degree: "Bachelor", year: 5 })).toBe("Bachelor 3. år");
	});

	it("maps master years onto the first or second master year", () => {
		expect([1, 2, 3, 4, 5].map((year) => cohortOf({ degree: "Master", year }))).toEqual([
			"Master 1. år",
			"Master 2. år",
			"Master 1. år",
			"Master 1. år",
			"Master 2. år",
		]);
	});

	it("keeps one cohort for årsstudium and PhD regardless of year", () => {
		expect(cohortOf({ degree: "Årsstudium", year: 2 })).toBe("Årsstudium");
		expect(cohortOf({ degree: "PhD", year: 4 })).toBe("PhD");
	});

	it("leaves students without a year before they started out of every cohort", () => {
		expect(cohortGroupOf({ degree: "Bachelor", year: 0 })).toBeNull();
		expect(cohortOf({ degree: "PhD", year: 0 })).toBe("");
	});
});

describe("audienceOf", () => {
	it("returns empty rows when nobody registered", () => {
		expect(audienceOf([], POPULATION)).toEqual({ total: 0, reached: 0, cohorts: [], programs: [] });
	});

	it("counts registrations and unique students separately", () => {
		const audience = audienceOf([ADA, ADA, CY], POPULATION);
		expect(audience.total).toBe(3);
		expect(audience.reached).toBe(2);
	});

	it("orders grouped cohorts by degree and then year with short codes", () => {
		const phd = student("ph", "PhD", 2);
		const oneYear = student("ar", "Årsstudium", 1);
		const masterTwo = student("ms", "Master", 5);
		const audience = audienceOf(
			[phd, CY, oneYear, masterTwo, DI, ADA],
			[...POPULATION, phd, oneYear, masterTwo],
		);
		expect(audience.cohorts.map(({ label, code }) => [label, code])).toEqual([
			["Bachelor 1. år", "B1"],
			["Bachelor 3. år", "B3"],
			["Master 1. år", "M1"],
			["Master 2. år", "M2"],
			["Årsstudium", "Å"],
			["PhD", "PhD"],
		]);
	});

	it("compares cohort shares against the population", () => {
		const [first] = audienceOf([ADA, ADA, CY], POPULATION).cohorts;
		expect(first).toMatchObject({
			label: "Bachelor 1. år",
			degree: "Bachelor",
			year: 1,
			registrations: 2,
			share: 2 / 3,
			populationShare: 2 / 4,
			change: null,
			previousReach: null,
		});
	});

	it("measures reach as unique registrants over cohort size", () => {
		const [bachelorOne, masterOne] = audienceOf([ADA, ADA, CY], POPULATION).cohorts;
		expect(bachelorOne?.reach).toBe(1 / 2);
		expect(masterOne?.reach).toBe(1);
	});

	it("caps reach at the whole cohort and treats unknown cohorts as unreached", () => {
		const outsider = student("fi", "Master", 5);
		const [masterOne, masterTwo] = audienceOf([CY, outsider], [CY]).cohorts;
		expect(masterOne?.reach).toBe(1);
		expect(masterTwo?.reach).toBe(0);
		expect(masterTwo?.populationShare).toBe(0);
	});

	it("reports change and previous reach against the previous period", () => {
		const [bachelorOne, masterFour] = audienceOf([ADA, CY], POPULATION, [ADA, BO, BO, CY]).cohorts;
		expect(bachelorOne?.change).toBeCloseTo(1 / 2 - 3 / 4);
		expect(bachelorOne?.previousReach).toBe(1);
		expect(masterFour?.change).toBeCloseTo(1 / 2 - 1 / 4);
		expect(masterFour?.previousReach).toBe(1);
	});

	it("reports zero previous reach for a cohort absent last period", () => {
		const [, masterFour] = audienceOf([ADA, CY], POPULATION, [ADA]).cohorts;
		expect(masterFour?.previousReach).toBe(0);
		expect(masterFour?.change).toBeCloseTo(1 / 2);
	});

	it("compares each cohort against the students who were in that year in the previous period", () => {
		const [bachelorThree] = audienceOf([DI], POPULATION, [DI], 1).cohorts;
		expect(bachelorThree?.label).toBe("Bachelor 3. år");
		expect(bachelorThree?.previousReach).toBe(0);
		expect(bachelorThree?.change).toBeCloseTo(1);

		const [bachelorOne] = audienceOf([ADA], POPULATION, [ADA, BO], 1).cohorts;
		expect(bachelorOne?.previousReach).toBe(0);
		expect(bachelorOne?.change).toBeCloseTo(1);
	});

	it("aligns program counts with the cohort order", () => {
		const { programs } = audienceOf([ADA, BO, CY, DI, DI], POPULATION);
		expect(programs).toEqual([
			expect.objectContaining({
				label: "Informatikk",
				registrations: 4,
				share: 4 / 5,
				populationShare: 3 / 4,
				change: null,
				byCohort: [1, 2, 1],
			}),
			expect.objectContaining({ label: "Matematikk", registrations: 1, byCohort: [1, 0, 0] }),
		]);
	});

	it("keeps the most popular programs, breaking ties by name", () => {
		const names = Array.from({ length: TOP_PROGRAMS + 2 }, (_, index) => `Program ${index}`);
		const registrants = [
			...names.map((name) => student(name, "Bachelor", 1, name)),
			student("extra", "Bachelor", 1, "Program 9"),
		];
		const { programs } = audienceOf(registrants, registrants);
		expect(programs).toHaveLength(TOP_PROGRAMS);
		expect(programs.map(({ label }) => label)).toEqual([
			"Program 9",
			...names.slice(0, TOP_PROGRAMS - 1),
		]);
	});

	it("counts registrants without a valid year but leaves them out of the cohorts", () => {
		const audience = audienceOf([ADA, student("zero", "Bachelor", 0)], POPULATION);
		expect(audience.total).toBe(2);
		expect(audience.cohorts.map(({ label }) => label)).toEqual(["Bachelor 1. år"]);
	});

	it("reports zero population share when the population is empty", () => {
		const [cohort] = audienceOf([ADA], []).cohorts;
		expect(cohort).toMatchObject({ populationShare: 0, reach: 0 });
	});
});
