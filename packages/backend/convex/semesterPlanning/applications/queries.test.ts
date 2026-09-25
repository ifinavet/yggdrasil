import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertOrganizer,
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
			internalNotes: "Hemmelig",
		});

		const plan = await asUser(t, member).query(queries.getPlan, { semesterId });

		expect(plan).toHaveLength(1);
		expect(plan[0]).toMatchObject({
			status: "applied",
			assignedDate: "2027-02-09",
			companyName: "FJORDKODE AS",
			responsibleName: "Emil Moe",
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

	it("shows the Navet team from the application, then from the event once it exists", async () => {
		const { t, companyId, semesterId, member } = await withPeople();
		const helper = await insertUser(t, "helper@ifinavet.no", {
			firstName: "Ida",
			lastName: "Hjelp",
		});
		const applicationId = await insertApplication(t, semesterId, {
			assignedDate: "2027-02-09",
			responsibleUserId: member._id,
			helperUserIds: [helper._id],
		});

		const before = await asUser(t, member).query(queries.getPlan, { semesterId });
		expect(before[0]).toMatchObject({
			responsibleName: "Emil Moe",
			helpers: [{ userId: helper._id, name: "Ida Hjelp" }],
		});

		// Organizers changed on the event win over what the application says.
		const eventId = await insertEvent(t, companyId);
		await insertOrganizer(t, eventId, helper._id);
		await t.run((ctx) => ctx.db.patch(applicationId, { eventId }));

		const after = await asUser(t, member).query(queries.getPlan, { semesterId });
		expect(after[0]).toMatchObject({ responsibleName: "Ida Hjelp", helpers: [] });
	});

	it("leaves out declined, rejected and withdrawn applications", async () => {
		const { t, semesterId, member } = await withPeople();
		for (const status of ["declined", "rejected", "withdrawn"] as const) {
			await insertApplication(t, semesterId, { status, assignedDate: "2027-02-09" });
		}
		const live = await insertApplication(t, semesterId, { assignedDate: "2027-02-09" });

		const plan = await asUser(t, member).query(queries.getPlan, { semesterId });
		expect(plan.map((row) => row._id)).toEqual([live]);
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

	it("get finds the company profile by organization number", async () => {
		const { t, semesterId, editor, companyId } = await withPeople();
		const applicationId = await insertApplication(t, semesterId, { orgNumber: "123456789" });

		const matched = await asUser(t, editor).query(queries.get, { applicationId });
		expect(matched.companyId).toBe(companyId);
		expect(matched.companyName).toBe("Testbedrift");
		expect(matched.offers).toEqual([]);
		expect(matched.activity).toEqual([]);

		const other = await insertApplication(t, semesterId, { orgNumber: "924773189" });
		expect(await asUser(t, editor).query(queries.get, { applicationId: other })).toMatchObject({
			companyId: null,
			companyName: null,
			logoUrl: null,
		});
	});
});

describe("listForSemester", () => {
	it("shows the latest offer's answer and the company's latest comment", async () => {
		const { t, semesterId, editor } = await withPeople();
		const waiting = await insertApplication(t, semesterId, {
			status: "new_date_requested",
			assignedDate: "2027-02-09",
		});
		const fresh = await insertApplication(t, semesterId);
		await t.run(async (ctx) => {
			const offer = {
				applicationId: waiting,
				date: "2027-02-09",
				eventType: "standard_presentation" as const,
				maxStudents: 40,
				sentBy: editor._id,
			};
			await ctx.db.insert("companyApplicationOffers", {
				...offer,
				linkToken: "old",
				sentAt: 1,
				status: "superseded",
			});
			const offerId = await ctx.db.insert("companyApplicationOffers", {
				...offer,
				linkToken: "new",
				sentAt: 2,
				status: "new_date_requested",
				respondedAt: 3,
				requestedDates: ["2027-02-16", "2027-02-11"],
			});
			await ctx.db.insert("companyApplicationActivity", {
				applicationId: waiting,
				type: "status_changed",
				actor: "company",
				fromStatus: "offer_sent",
				toStatus: "new_date_requested",
				offerId,
				comment: "Helst en torsdag.",
			});
		});

		const rows = await asUser(t, editor).query(queries.listForSemester, { semesterId });

		expect(rows.map((row) => [row._id, row.latestOffer, row.companyComment])).toEqual([
			[
				waiting,
				{
					status: "new_date_requested",
					respondedAt: 3,
					requestedDates: ["2027-02-16", "2027-02-11"],
				},
				"Helst en torsdag.",
			],
			[fresh, null, null],
		]);
	});
});
