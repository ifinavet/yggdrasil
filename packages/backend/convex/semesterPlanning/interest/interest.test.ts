import { describe, expect, it } from "vitest";
import { refusalMessageFrom, setup, type TestBackend } from "../../../test/fixtures";
import { api } from "../../_generated/api";

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
		).toBe("Det er sendt mange på kort tid. Prøv igjen senere.");
		expect(await scheduledEmails(t)).toHaveLength(3);
	});
});
