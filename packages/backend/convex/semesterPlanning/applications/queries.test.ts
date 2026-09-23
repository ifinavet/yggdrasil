import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertApplication,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";

const queries = api.semesterPlanning.applications.queries;

async function withPeople() {
	const { t, companyId } = await setup();
	const editor = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editor._id, "editor");
	const member = await insertUser(t, "medlem@ifinavet.no", { firstName: "Emil", lastName: "Moe" });
	await grantRole(t, member._id, "internal");
	const semesterId = await insertSemester(t);
	return { t, companyId, semesterId, editor, member };
}

describe("getPlan", () => {
	it("gives internal members the plan without contact, invoice or notes", async () => {
		const { t, semesterId, member } = await withPeople();
		await insertApplication(t, semesterId, {
			assignedDate: "2027-02-09",
			responsibleUserId: member._id,
			room: "Simula",
			internalNotes: "Hemmelig",
		});

		const plan = await asUser(t, member).query(queries.getPlan, { semesterId });

		expect(plan).toHaveLength(1);
		expect(plan[0]).toMatchObject({
			status: "applied",
			assignedDate: "2027-02-09",
			companyName: "FJORDKODE AS",
			responsibleName: "Emil Moe",
			room: "Simula",
		});
		const serialized = JSON.stringify(plan);
		for (const secret of [
			"ingrid@fjordkode.no",
			"+4741234567",
			"faktura@fjordkode.no",
			"Hemmelig",
		]) {
			expect(serialized).not.toContain(secret);
		}
		expect(Object.keys(plan[0] ?? {})).not.toEqual(
			expect.arrayContaining(["contact", "billing", "internalNotes"]),
		);
	});

	it("requires login", async () => {
		const { t, semesterId } = await withPeople();
		expect(await refusalMessageFrom(t.query(queries.getPlan, { semesterId }))).toContain(
			"innlogget",
		);
	});
});

describe("editor queries", () => {
	it("listForSemester and get are editor-only", async () => {
		const { t, semesterId, member } = await withPeople();
		const applicationId = await insertApplication(t, semesterId);

		expect(
			await refusalMessageFrom(asUser(t, member).query(queries.listForSemester, { semesterId })),
		).toContain("Unauthorized");
		expect(
			await refusalMessageFrom(asUser(t, member).query(queries.get, { applicationId })),
		).toContain("Unauthorized");
	});

	it("listForSemester returns full applications, oldest first", async () => {
		const { t, semesterId, editor } = await withPeople();
		const first = await insertApplication(t, semesterId);
		const second = await insertApplication(t, semesterId);

		const list = await asUser(t, editor).query(queries.listForSemester, { semesterId });

		expect(list.map((application) => application._id)).toEqual([first, second]);
		expect(list[0]?.contact.email).toBe("ingrid@fjordkode.no");
	});

	it("get suggests the company profile with the same organization number until it is linked", async () => {
		const { t, semesterId, editor, companyId } = await withPeople();
		const applicationId = await insertApplication(t, semesterId, { orgNumber: "123456789" });

		const before = await asUser(t, editor).query(queries.get, { applicationId });
		expect(before.matchingCompanyId).toBe(companyId);
		expect(before.offers).toEqual([]);
		expect(before.activity).toEqual([]);

		await t.run((ctx) => ctx.db.patch(applicationId, { companyId }));
		const after = await asUser(t, editor).query(queries.get, { applicationId });
		expect(after.matchingCompanyId).toBeNull();
	});
});
