import {
	degreesFor,
	fittingDegree,
	fittingYear,
	studentProfileIssue,
	yearsFor,
} from "@workspace/shared/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertStudent,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { normalizedStudent } from "./migrations";

const NOW = Date.UTC(2026, 8, 27);
const LAST_UPDATE = Date.UTC(2026, 7, 1);
const HEALTH = "Digitalisering i helsesektoren";
const PROGRAMMING = "Informatikk: programmering og systemarkitektur";

afterEach(() => {
	vi.useRealTimers();
});

function studentOf(t: TestBackend, id: Id<"students">) {
	return t.run((ctx) => ctx.db.get(id));
}

describe("studentProfileIssue", () => {
	it("accepts a valid profile", () => {
		expect(studentProfileIssue({ studyProgram: HEALTH, degree: "Master", year: 4 })).toBeNull();
	});

	it("rejects unknown programs, degrees the program lacks and years outside the degree", () => {
		expect(
			studentProfileIssue({ studyProgram: "Ukjent", degree: "Bachelor", year: 1 })?.field,
		).toBe("studyProgram");
		expect(studentProfileIssue({ studyProgram: HEALTH, degree: "Bachelor", year: 3 })).toEqual({
			field: "degree",
			message: `${HEALTH} tilbys ikke som Bachelor.`,
		});
		expect(studentProfileIssue({ studyProgram: HEALTH, degree: "Master", year: 2 })).toEqual({
			field: "year",
			message: "År må være mellom 4 og 5 for Master.",
		});
	});

	it("fits a degree to the program and a year to the degree", () => {
		expect(fittingDegree(HEALTH, "Bachelor")).toBe("Master");
		expect(fittingDegree(HEALTH, "PhD")).toBe("PhD");
		expect(fittingYear("Master", 1)).toBe(4);
		expect(fittingYear("Bachelor", 5)).toBe(3);
		expect(fittingYear("Bachelor", 2)).toBe(2);
	});

	it("offers every degree for unknown programs and the years of each degree", () => {
		expect(degreesFor("Ukjent")).toHaveLength(4);
		expect(yearsFor("Master")).toEqual([4, 5]);
		expect(yearsFor("Årsstudium")).toEqual([1]);
	});
});

describe("normalizedStudent", () => {
	const base = { studyProgram: PROGRAMMING, graduatedAt: undefined };

	it("leaves valid and already graduated students alone", () => {
		expect(normalizedStudent({ ...base, degree: "Bachelor", year: 2 }, NOW)).toBeUndefined();
		expect(
			normalizedStudent({ ...base, degree: "Bachelor", year: 9, graduatedAt: 1 }, NOW),
		).toBeUndefined();
	});

	it("moves students on graduate programs to master and shifts early master years", () => {
		expect(normalizedStudent({ studyProgram: HEALTH, degree: "Bachelor", year: 1 }, NOW)).toEqual({
			degree: "Master",
			year: 4,
		});
		expect(normalizedStudent({ ...base, degree: "Master", year: 2 }, NOW)).toEqual({
			degree: "Master",
			year: 5,
		});
	});

	it("uses the only degree a program offers", () => {
		expect(
			normalizedStudent(
				{ studyProgram: "Informatikk (årsenhet)", degree: "Bachelor", year: 1 },
				NOW,
			),
		).toEqual({ degree: "Årsstudium", year: 1 });
	});

	it("falls back to the first degree a program lists", () => {
		expect(
			normalizedStudent({ studyProgram: PROGRAMMING, degree: "Årsstudium", year: 1 }, NOW),
		).toEqual({ degree: "Bachelor", year: 1 });
	});

	it("marks students past their last year as graduated at the matching yearly update", () => {
		expect(normalizedStudent({ ...base, degree: "Bachelor", year: 4 }, NOW)).toEqual({
			degree: "Bachelor",
			year: 3,
			graduatedAt: LAST_UPDATE,
		});
		expect(
			normalizedStudent({ ...base, degree: "Bachelor", year: 5 }, Date.UTC(2026, 5, 1)),
		).toEqual({ degree: "Bachelor", year: 3, graduatedAt: Date.UTC(2024, 7, 1) });
	});
});

describe("normalizeStudents", () => {
	it("patches every student that needs it", async () => {
		vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
		const { t } = await setup();
		const user = await insertUser(t, "a@example.com");
		const wrapped = await insertStudent(t, user._id, { studyProgram: HEALTH, year: 3 });
		const valid = await insertStudent(t, user._id, { studyProgram: PROGRAMMING, year: 2 });

		await t.mutation(internal.users.students.migrations.normalizeStudents, {
			oneBatchOnly: true,
			cursor: null,
			dryRun: false,
		});

		expect(await studentOf(t, wrapped)).toMatchObject({
			degree: "Master",
			year: 5,
			graduatedAt: LAST_UPDATE,
		});
		expect(await studentOf(t, valid)).toMatchObject({ degree: "Bachelor", year: 2 });
	});
});

describe("updateYear", () => {
	it("moves current students up and graduates those in their last year", async () => {
		vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
		const { t } = await setup();
		const user = await insertUser(t, "a@example.com");
		const second = await insertStudent(t, user._id, { year: 2 });
		const last = await insertStudent(t, user._id, { year: 3 });
		const graduated = await insertStudent(t, user._id, { year: 3, graduatedAt: 1 });
		const phd = await insertStudent(t, user._id, { degree: "PhD", year: 5 });

		await t.mutation(internal.users.students.mutations.updateYear, {});

		expect(await studentOf(t, second)).toMatchObject({ year: 3 });
		expect((await studentOf(t, second))?.graduatedAt).toBeUndefined();
		expect(await studentOf(t, last)).toMatchObject({ year: 3, graduatedAt: NOW });
		expect(await studentOf(t, graduated)).toMatchObject({ year: 3, graduatedAt: 1 });
		const stillPhd = await studentOf(t, phd);
		expect(stillPhd?.year).toBe(5);
		expect(stillPhd?.graduatedAt).toBeUndefined();
	});
});

describe("profile updates", () => {
	it("refuses a profile the program does not offer", async () => {
		const { t } = await setup();
		const user = await insertUser(t, "a@example.com");
		await insertStudent(t, user._id);

		expect(
			await refusalMessageFrom(
				asUser(t, user).mutation(api.users.students.mutations.updateCurrent, {
					studyProgram: HEALTH,
					degree: "Bachelor",
					year: 3,
				}),
			),
		).toBe(`${HEALTH} tilbys ikke som Bachelor.`);
	});

	it("brings a graduated student back when they update their profile", async () => {
		const { t } = await setup();
		const user = await insertUser(t, "a@example.com");
		const student = await insertStudent(t, user._id, { year: 3, graduatedAt: 1 });

		await asUser(t, user).mutation(api.users.students.mutations.updateCurrent, {
			studyProgram: PROGRAMMING,
			degree: "Master",
			year: 4,
		});

		const updated = await studentOf(t, student);
		expect(updated).toMatchObject({ degree: "Master", year: 4 });
		expect(updated?.graduatedAt).toBeUndefined();
	});

	it("lets an admin correct another student and clears graduation", async () => {
		const { t } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const user = await insertUser(t, "a@example.com");
		const student = await insertStudent(t, user._id, { year: 5, graduatedAt: 1 });

		await asUser(t, admin).mutation(api.users.students.mutations.update, {
			id: student,
			studyProgram: HEALTH,
			degree: "Master",
			year: 5,
		});

		const updated = await studentOf(t, student);
		expect(updated).toMatchObject({ studyProgram: HEALTH, degree: "Master" });
		expect(updated?.graduatedAt).toBeUndefined();
	});
});
