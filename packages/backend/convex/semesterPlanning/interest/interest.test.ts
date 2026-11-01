import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";

const register = api.semesterPlanning.interest.mutations.register;

async function scheduledEmails(t: TestBackend) {
	const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(20));
	return scheduled
		.filter(({ name }) => name.includes("interest/emails"))
		.map(({ args }) => args[0]);
}

describe("register", () => {
	it("emails Navet the company's name and trimmed email", async () => {
		const { t } = await setup();

		await t.mutation(register, { companyName: " Fjordkode AS ", email: " ingrid@fjordkode.no " });

		expect(await scheduledEmails(t)).toEqual([
			{ companyName: "Fjordkode AS", email: "ingrid@fjordkode.no" },
		]);
	});

	it("refuses a missing name or an invalid email", async () => {
		const { t } = await setup();

		expect(
			await refusalMessageFrom(t.mutation(register, { companyName: " ", email: "a@b.no" })),
		).toBe("Skriv navnet på bedriften.");
		expect(
			await refusalMessageFrom(t.mutation(register, { companyName: "Fjordkode", email: "ingrid" })),
		).toBe("Skriv en gyldig e-postadresse.");
		expect(await scheduledEmails(t)).toEqual([]);
	});

	it("answers a filled-in honeypot like a success and sends nothing", async () => {
		const { t } = await setup();

		await t.mutation(register, {
			companyName: "Fjordkode",
			email: "bot@example.com",
			website: "https://spam.example",
		});

		expect(await scheduledEmails(t)).toEqual([]);
	});

	it("limits how often one email address can ask", async () => {
		const { t } = await setup();
		const answers = { companyName: "Fjordkode", email: "Ingrid@fjordkode.no" };
		for (let sent = 0; sent < 3; sent++) await t.mutation(register, answers);

		expect(
			await refusalMessageFrom(t.mutation(register, { ...answers, email: "ingrid@fjordkode.no" })),
		).toBe("Det har kommet mange henvendelser på kort tid. Vent litt, og prøv igjen om en stund.");
		expect(await scheduledEmails(t)).toHaveLength(3);
	});
});

describe("telling companies when applications open", () => {
	async function interested(t: TestBackend) {
		return await t.run((ctx) => ctx.db.query("companyInterest").collect());
	}

	it("keeps one row per email address, with the latest name", async () => {
		const { t } = await setup();

		await t.mutation(register, { companyName: "Fjordkode", email: "Ingrid@Fjordkode.no" });
		await t.mutation(register, { companyName: "Fjordkode AS", email: "ingrid@fjordkode.no" });

		expect(await interested(t)).toMatchObject([
			{ companyName: "Fjordkode AS", email: "ingrid@fjordkode.no" },
		]);
	});

	it("schedules the email when a semester opens, and only then", async () => {
		const { t } = await setup();
		const editor = await insertUser(t, "kari@ifinavet.no");
		await grantRole(t, editor._id, "editor");
		const semesterId = await insertSemester(t, { status: "draft", lastDate: "2099-05-13" });
		await t.run((ctx) => ctx.db.insert("semesterDates", { semesterId, date: "2027-01-21" }));
		const setStatus = api.semesterPlanning.semesters.mutations.setStatus;

		await asUser(t, editor).mutation(setStatus, { semesterId, status: "open" });
		await asUser(t, editor).mutation(setStatus, { semesterId, status: "open" });

		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(
			scheduled.filter(({ name }) => name.includes("notifyApplicationsOpen")).map((s) => s.args),
		).toEqual([[{ semesterId }]]);
	});

	it("lists the companies only while the semester is open, and forgets them afterwards", async () => {
		const { t } = await setup();
		await t.mutation(register, { companyName: "Fjordkode AS", email: "ingrid@fjordkode.no" });
		const openId = await insertSemester(t, { status: "open" });
		const draftId = await insertSemester(t, { status: "draft", year: 2028 });
		const interest = internal.semesterPlanning.interest.mutations;

		expect(await t.query(interest.forOpening, { semesterId: draftId })).toBeNull();
		const opening = await t.query(interest.forOpening, { semesterId: openId });
		expect(opening).toMatchObject({
			term: "spring",
			year: 2027,
			applicationDeadline: "2026-12-04",
			companies: [{ companyName: "Fjordkode AS", email: "ingrid@fjordkode.no" }],
		});

		await t.mutation(interest.forget, { ids: opening?.companies.map(({ _id }) => _id) ?? [] });
		expect(await interested(t)).toEqual([]);
	});
});
