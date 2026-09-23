import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertUser,
	setup,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

const answers = {
	satisfaction: 5,
	impression: 4,
	expectation: 3,
	toughts: "Bra",
	improvements: "Mer tid",
	want_to_work: "ja",
	word_of_mouth: ["Ifinavet.no"],
	other: "",
};
const submit = api.forms.mutations.submitFormResponse;
const own = api.forms.queries.getCurrentUsersResponseByFormId;
const eligible = api.forms.queries.checkIfCurrentUserAttendedTheEventAndShouldBeAbleToSubmit;
async function fixture(attendanceStatus: Doc<"registrations">["attendanceStatus"] = "confirmed") {
	const { t, companyId } = await setup();
	const user = await insertUser(t, "student@example.test");
	const formId = await t.mutation(internal.forms.mutations.createEventFeedbackForm, {});
	const eventId = await insertEvent(t, companyId, { formId });
	const registrationId = await insertRegistration(t, eventId, user._id, "registered");
	await t.run((ctx) => ctx.db.patch(registrationId, { attendanceStatus }));
	return { t, companyId, user, formId, eventId, registrationId, client: asUser(t, user) };
}

describe("legacy feedback submission", () => {
	it.each(["confirmed", "late"] as const)(
		"accepts %s attendance and stores server-derived identity",
		async (attendance) => {
			const { t, user, formId, eventId, client } = await fixture(attendance);
			expect(await client.query(eligible, { eventId })).toBe(true);
			expect(await client.query(own, { formId })).toBeNull();
			await client.mutation(submit, { formId, data: answers });
			const response = await client.query(own, { formId });
			expect(response?.data).toEqual({ ...answers, userId: user.externalId, eventId });
			const other = await insertUser(t, "other@example.test");
			expect(await asUser(t, other).query(own, { formId })).toBeNull();
		},
	);
	it("keeps current callers compatible when canonical metadata is included", async () => {
		const { client, formId, eventId, user } = await fixture();
		await client.mutation(submit, {
			formId,
			data: { ...answers, userId: user.externalId, eventId },
		});
		expect((await client.query(own, { formId }))?.data).toEqual({
			...answers,
			userId: user.externalId,
			eventId,
		});
	});
	it("preserves organizer eligibility without an attendance record", async () => {
		const { t, client, formId, eventId, user, registrationId } = await fixture();
		await t.run((ctx) => ctx.db.delete(registrationId));
		await insertOrganizer(t, eventId, user._id);
		expect(await client.query(eligible, { eventId })).toBe(true);
		await client.mutation(submit, { formId, data: answers });
		expect(await client.query(own, { formId })).not.toBeNull();
	});
	it.each(["no_show", undefined] as const)(
		"rejects %s attendance on both query and write",
		async (attendance) => {
			const { t, client, formId, eventId, registrationId } = await fixture();
			await t.run((ctx) => ctx.db.patch(registrationId, { attendanceStatus: attendance }));
			expect(await client.query(eligible, { eventId })).toBe(false);
			await expect(client.mutation(submit, { formId, data: answers })).rejects.toThrow(
				"Du kan ikke svare",
			);
			expect(await client.query(own, { formId })).toBeNull();
		},
	);
	it("rejects non-attendees and cannot be bypassed using another attendee's identity", async () => {
		const { t, formId, eventId, user } = await fixture();
		const outsider = asUser(t, await insertUser(t, "outsider@example.test"));
		expect(await outsider.query(eligible, { eventId })).toBe(false);
		await expect(
			outsider.mutation(submit, { formId, data: { ...answers, userId: user.externalId, eventId } }),
		).rejects.toThrow("Du kan ikke svare");
		expect(await outsider.query(own, { formId })).toBeNull();
	});
	it("rejects unauthenticated writes and own-answer reads", async () => {
		const { t, formId, eventId } = await fixture();
		await expect(t.mutation(submit, { formId, data: answers })).rejects.toThrow("Unauthorized");
		await expect(t.query(own, { formId })).rejects.toThrow("Unauthorized");
		await expect(t.query(eligible, { eventId })).rejects.toThrow("Unauthorized");
	});
	it.each([{ userId: "someone-else" }, { eventId: "another-event" }])(
		"rejects forged metadata %j",
		async (metadata) => {
			const { client, formId } = await fixture();
			await expect(
				client.mutation(submit, { formId, data: { ...answers, ...metadata } }),
			).rejects.toThrow("tilhører ikke");
			expect(await client.query(own, { formId })).toBeNull();
		},
	);
	it.each([
		{ satisfaction: 6 },
		{ satisfaction: "5" },
		{ toughts: " " },
		{ improvements: "" },
		{ other: "x".repeat(1001) },
		{ word_of_mouth: [] },
		{ unexpected: true },
	])("rejects invalid answers %j without spending the response", async (patch) => {
		const { client, formId } = await fixture();
		await expect(
			client.mutation(submit, { formId, data: { ...answers, ...patch } }),
		).rejects.toThrow("ugyldige felt");
		expect(await client.query(own, { formId })).toBeNull();
		await client.mutation(submit, { formId, data: answers });
		expect(await client.query(own, { formId })).not.toBeNull();
	});
	it("rejects missing forms", async () => {
		const { t, client, formId } = await fixture();
		await t.run((ctx) => ctx.db.delete(formId));
		await expect(client.mutation(submit, { formId, data: answers })).rejects.toThrow(
			"Skjemaet finnes ikke",
		);
	});
	it("rejects orphaned forms and deleted events", async () => {
		const { t, client, formId, eventId } = await fixture();
		await t.run((ctx) => ctx.db.delete(eventId));
		expect(await client.query(eligible, { eventId })).toBe(false);
		await expect(client.mutation(submit, { formId, data: answers })).rejects.toThrow(
			"ett arrangement",
		);
	});
	it("rejects a form assigned to multiple events", async () => {
		const { t, client, companyId, formId } = await fixture();
		await insertEvent(t, companyId, { formId });
		await expect(client.mutation(submit, { formId, data: answers })).rejects.toThrow(
			"ett arrangement",
		);
	});
	it("rejects repeat submissions, including pre-existing legacy responses", async () => {
		const { t, client, formId, user } = await fixture();
		await t.run((ctx) =>
			ctx.db.insert("formResponses", { formId, data: { ...answers, userId: user.externalId } }),
		);
		await expect(client.mutation(submit, { formId, data: answers })).rejects.toThrow(
			"allerede svart",
		);
		expect(await t.run((ctx) => ctx.db.query("formResponses").collect())).toHaveLength(1);
	});
	it("accepts exactly one of two concurrent submissions", async () => {
		const { t, client, formId } = await fixture();
		const results = await Promise.allSettled([
			client.mutation(submit, { formId, data: answers }),
			client.mutation(submit, { formId, data: answers }),
		]);
		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.query("formResponses").collect())).toHaveLength(1);
	});
	it("keeps listing-application behavior separate", async () => {
		const { t, client } = await fixture();
		const formId = await t.run((ctx) => ctx.db.insert("form", { formType: "listing-application" }));
		const data = { custom: "Application", userId: "legacy-id" };
		await client.mutation(submit, { formId, data });
		expect(
			await t.run((ctx) =>
				ctx.db
					.query("formResponses")
					.withIndex("by_formId", (q) => q.eq("formId", formId))
					.first(),
			),
		).toMatchObject({ data });
	});
	it("preserves internal report access while denying students", async () => {
		const { t, client, formId, user } = await fixture();
		await client.mutation(submit, { formId, data: answers });
		await expect(
			client.query(api.forms.queries.getFormResponsesByFormId, { formId }),
		).rejects.toThrow();
		await grantRole(t, user._id, "admin");
		expect(await client.query(api.forms.queries.getFormResponsesByFormId, { formId })).toHaveLength(
			1,
		);
	});
});
