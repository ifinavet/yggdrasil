import { eventTextComplete, helperConfirmation } from "@workspace/shared/events/checklist";
import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertEvent, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

async function setupChecklist() {
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId);
	const user = await insertUser(t, "checklist@example.test");
	await grantRole(t, user._id, "internal");
	return { t, eventId, companyId, client: asUser(t, user) };
}

describe("event checklist", () => {
	it("persists independent steps, makes repeat completion idempotent and allows undo", async () => {
		const { t, eventId, companyId, client } = await setupChecklist();
		const other = await insertEvent(t, companyId);
		const set = (stepId: string, completed = true) =>
			client.mutation(api.events.mutations.setChecklistStep, { eventId, stepId, completed });
		await set("company-contact");
		await set("room");
		await set("attendance");
		await set("company-contact");
		expect((await t.run((ctx) => ctx.db.get(eventId)))?.completedChecklistSteps).toEqual([
			"company-contact",
			"room",
			"attendance",
		]);
		await set("company-contact", false);
		expect((await t.run((ctx) => ctx.db.get(eventId)))?.completedChecklistSteps).toEqual([
			"room",
			"attendance",
		]);
		expect((await t.run((ctx) => ctx.db.get(other)))?.completedChecklistSteps).toBeUndefined();
	});
	it("rejects anonymous and student writes", async () => {
		const { t, eventId } = await setupChecklist();
		const args = { eventId, stepId: "room", completed: true };
		await expect(t.mutation(api.events.mutations.setChecklistStep, args)).rejects.toThrow();
		const student = asUser(t, await insertUser(t, "student-checklist@example.test"));
		await expect(student.mutation(api.events.mutations.setChecklistStep, args)).rejects.toThrow();
		expect((await t.run((ctx) => ctx.db.get(eventId)))?.completedChecklistSteps).toBeUndefined();
	});
	it("rejects unknown steps and deleted events", async () => {
		const { t, eventId, client } = await setupChecklist();
		await expect(
			client.mutation(api.events.mutations.setChecklistStep, {
				eventId,
				stepId: "unknown",
				completed: true,
			}),
		).rejects.toThrow("Ukjent sjekklistepunkt");
		await t.run((ctx) => ctx.db.delete(eventId));
		await expect(
			client.mutation(api.events.mutations.setChecklistStep, {
				eventId,
				stepId: "room",
				completed: true,
			}),
		).rejects.toThrow("Arrangementet finnes ikke");
	});
});

it("names the assigned helpers and handles zero, one and several helpers", () => {
	expect(helperConfirmation([])).toBe("Velg medhjelpere");
	expect(helperConfirmation(["Ada"])).toBe("Bekreft at Ada skal være medhjelper");
	expect(helperConfirmation(["Ada", "Linus"])).toBe(
		"Bekreft at Ada og Linus skal være medhjelpere",
	);
	expect(helperConfirmation(["Ada", "Linus", "Grace"])).toBe(
		"Bekreft at Ada, Linus og Grace skal være medhjelpere",
	);
});

describe("automatic event text completion", () => {
	const complete = {
		title: "Kodekveld",
		teaser: "Lær om databaser",
		description: "<p>Velkommen til en kodekveld.</p>",
	};
	it("requires real text in all three fields", () => {
		expect(eventTextComplete(complete)).toBe(true);
		for (const field of ["title", "teaser", "description"] as const) {
			for (const value of [
				"TBD",
				" tbd ",
				"",
				" ",
				"<p><br></p>",
				"<p>&nbsp;</p>",
				"<p><strong>TBD</strong></p>",
				"Mer info kommer",
				"<p>Program</p><p>TBD</p>",
			]) {
				expect(eventTextComplete({ ...complete, [field]: value })).toBe(false);
			}
		}
	});
	it("cannot be completed manually", async () => {
		const { client, eventId } = await setupChecklist();
		await expect(
			client.mutation(api.events.mutations.setChecklistStep, {
				eventId,
				stepId: "description",
				completed: true,
			}),
		).rejects.toThrow();
	});
});
