/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
	asUser,
	countRowsIn,
	grantRole,
	insertStudent,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../test/fixtures";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const UPDATED_STUDY = { year: 4, studyProgram: "Robotikk", degree: "Master" as const };

async function studyProgramOf(t: TestBackend, studentId: Id<"students">) {
	return t.run(async (ctx) => (await ctx.db.get(studentId))?.studyProgram ?? null);
}

describe("students.mutations.update", () => {
	it("refuses a stranger", async () => {
		const { t } = await setup();
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const stranger = await insertUser(t, "fremmed@example.com");
		await insertStudent(t, stranger._id);

		const message = await refusalMessageFrom(
			asUser(t, stranger).mutation(api.users.students.mutations.update, {
				id: studentId,
				...UPDATED_STUDY,
			}),
		);

		expect(message).toContain("kun oppdatere din egen studentprofil");
		expect(await studyProgramOf(t, studentId)).toBe("Informatikk");
	});

	it("lets the owner update their own profile", async () => {
		const { t } = await setup();
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);

		await asUser(t, owner).mutation(api.users.students.mutations.update, {
			id: studentId,
			...UPDATED_STUDY,
		});

		expect(await studyProgramOf(t, studentId)).toBe("Robotikk");
	});

	it("lets an admin update someone else's profile", async () => {
		const { t } = await setup();
		const owner = await insertUser(t, "eier@example.com");
		const studentId = await insertStudent(t, owner._id);
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");

		await asUser(t, admin).mutation(api.users.students.mutations.update, {
			id: studentId,
			...UPDATED_STUDY,
		});

		expect(await studyProgramOf(t, studentId)).toBe("Robotikk");
	});
});

describe("students.mutations.createByExternalId", () => {
	const newStudent = {
		degree: "Bachelor" as const,
		year: 1,
		studyProgram: "Informatikk",
		name: "Ny Student",
	};

	it("refuses an externalId that is not the signed-in subject", async () => {
		const { t } = await setup();

		const message = await refusalMessageFrom(
			t
				.withIdentity({ subject: "clerk_meg" })
				.mutation(api.users.students.mutations.createByExternalId, {
					externalId: "clerk_noen_andre",
					...newStudent,
				}),
		);

		expect(message).toContain("stemmer ikke med innlogget bruker");
		expect(await countRowsIn(t, "students")).toBe(0);
	});

	it("patches instead of inserting when called twice by the same identity", async () => {
		const { t } = await setup();
		const caller = t.withIdentity({ subject: "clerk_meg" });

		await caller.mutation(api.users.students.mutations.createByExternalId, {
			externalId: "clerk_meg",
			...newStudent,
		});
		await caller.mutation(api.users.students.mutations.createByExternalId, {
			externalId: "clerk_meg",
			...newStudent,
			studyProgram: "Robotikk",
		});

		expect(await countRowsIn(t, "users")).toBe(1);
		expect(await countRowsIn(t, "students")).toBe(1);
	});
});

describe("admin-only student reads", () => {
	async function studentBackend() {
		const { t } = await setup();
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const subject = await insertUser(t, "student@example.com");
		const studentId = await insertStudent(t, subject._id);

		return { t, internalUser, admin, studentId };
	}

	it("refuses getAllPaged for an internal and allows it for an admin", async () => {
		const { t, internalUser, admin } = await studentBackend();
		const paginationOpts = { numItems: 10, cursor: null };

		const message = await refusalMessageFrom(
			asUser(t, internalUser).query(api.users.students.queries.getAllPaged, { paginationOpts }),
		);
		expect(message).toContain("Krever rollen: super-admin eller admin.");

		const page = await asUser(t, admin).query(api.users.students.queries.getAllPaged, {
			paginationOpts,
		});
		expect(page.page).toHaveLength(1);
	});

	it("refuses getAllWithPoints for an internal and allows it for an admin", async () => {
		const { t, internalUser, admin } = await studentBackend();

		const message = await refusalMessageFrom(
			asUser(t, internalUser).query(api.users.students.queries.getAllWithPoints, {}),
		);
		expect(message).toContain("Krever rollen: super-admin eller admin.");

		expect(await asUser(t, admin).query(api.users.students.queries.getAllWithPoints, {})).toEqual(
			[],
		);
	});

	it("refuses getById for an internal and allows it for an admin", async () => {
		const { t, internalUser, admin, studentId } = await studentBackend();

		const message = await refusalMessageFrom(
			asUser(t, internalUser).query(api.users.students.queries.getById, { id: studentId }),
		);
		expect(message).toContain("Krever rollen: super-admin eller admin.");

		const student = await asUser(t, admin).query(api.users.students.queries.getById, {
			id: studentId,
		});
		expect(student.email).toBe("student@example.com");
	});
});

describe("users.clerk.queries.searchAfterUsers", () => {
	it("refuses anonymous callers and allows an internal", async () => {
		const { t } = await setup();
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");
		const paginationOpts = { numItems: 10, cursor: null };

		const message = await refusalMessageFrom(
			t.query(api.users.clerk.queries.searchAfterUsers, {
				searchInput: "intern",
				paginationOpts,
			}),
		);
		expect(message).toContain("innlogget");

		const found = await asUser(t, internalUser).query(api.users.clerk.queries.searchAfterUsers, {
			searchInput: "intern@example.com",
			paginationOpts,
		});
		expect(found.page).toHaveLength(1);
	});
});
