import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertEvent, insertUser, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { AccessRole } from "../../auth/accessRights";
import { defaultFeedbackFields } from "../defaultFields";

const m = api.feedback.forms.mutations;
const q = api.feedback.forms.queries;
const page = { cursor: null, numItems: 2 };
async function fixture() {
	const { t, companyId } = await setup();
	const user = await insertUser(t, "owner@example.test");
	await grantRole(t, user._id, "super-admin");
	const client = asUser(t, user);
	const eventId = await insertEvent(t, companyId);
	const formId = await client.mutation(m.saveDraft, {
		name: "  Feedback  ",
		fields: defaultFeedbackFields,
	});
	return { t, client, user, eventId, formId };
}

describe("feedback form management", () => {
	it("saves normalized drafts and publishes ordered immutable snapshots", async () => {
		const { t, client, user, formId, eventId } = await fixture();
		expect(await client.query(q.getDraft, { formId })).toMatchObject({
			name: "Feedback",
			isDefault: false,
			draftFields: defaultFeedbackFields,
		});
		const versionId = await client.mutation(m.publish, { formId });
		const first = await client.query(q.getVersion, { versionId });
		expect(first).toMatchObject({
			name: "Feedback",
			formDefinitionId: formId,
			createdBy: user._id,
		});
		expect(
			first.fields.map(({ _id, _creationTime, formVersionId, order, ...field }) => field),
		).toEqual(defaultFeedbackFields);
		expect(first.fields.map((f) => f.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(await client.query(q.getDraft, { formId })).not.toHaveProperty("draftFields");
		const campaignId = await t.run((ctx) =>
			ctx.db.insert("feedbackCampaigns", {
				eventId,
				formVersionId: versionId,
				status: "open",
				opensAt: 1,
				closesAt: 2,
				generation: 1,
			}),
		);
		await client.mutation(m.saveDraft, {
			formId,
			name: "Revised",
			fields: [...defaultFeedbackFields].reverse(),
		});
		expect(await client.query(q.getVersion, { versionId })).toEqual(first);
		const revised = await client.mutation(m.publish, { formId });
		expect(revised).not.toBe(versionId);
		expect(
			(await client.query(q.getVersion, { versionId: revised })).fields.map((f) => f.key),
		).toEqual(defaultFeedbackFields.map((f) => f.key).reverse());
		expect(await client.query(q.getVersion, { versionId })).toEqual(first);
		expect((await t.run((ctx) => ctx.db.get(campaignId)))?.formVersionId).toBe(versionId);
	});
	it.each([
		{ name: " ", fields: defaultFeedbackFields },
		{ name: "x".repeat(201), fields: defaultFeedbackFields },
		{ name: "Form", fields: [] },
		{ name: "Form", fields: [defaultFeedbackFields[0], defaultFeedbackFields[0]] },
		{
			name: "Form",
			fields: [{ key: "options", type: "options" as const, label: "Choose", required: true }],
		},
		{ name: "Form", fields: [{ ...defaultFeedbackFields[0], key: "constructor" }] },
	])("rejects invalid definitions atomically: %j", async (input) => {
		const { client, formId } = await fixture();
		const before = await client.query(q.getDraft, { formId });
		await expect(client.mutation(m.saveDraft, { formId, ...input })).rejects.toThrow();
		expect(await client.query(q.getDraft, { formId })).toEqual(before);
	});
	it("cannot publish absent or corrupt drafts", async () => {
		const { t, client, formId } = await fixture();
		await client.mutation(m.publish, { formId });
		await expect(client.mutation(m.publish, { formId })).rejects.toThrow("gyldig utkast");
		await t.run((ctx) => ctx.db.patch(formId, { draftFields: [] }));
		await expect(client.mutation(m.publish, { formId })).rejects.toThrow("gyldig utkast");
		expect(await t.run((ctx) => ctx.db.query("formVersions").collect())).toHaveLength(1);
	});
	it("publishes a draft only once under concurrent requests", async () => {
		const { t, client, formId } = await fixture();
		const results = await Promise.allSettled([
			client.mutation(m.publish, { formId }),
			client.mutation(m.publish, { formId }),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.query("formVersions").collect())).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.query("formFields").collect())).toHaveLength(8);
	});
	it("requires a published version for defaults and assignment", async () => {
		const { client, formId, eventId } = await fixture();
		expect(await client.query(q.getDefault, {})).toBeNull();
		await expect(client.mutation(m.setDefault, { formId })).rejects.toThrow("Publiser");
		await expect(client.mutation(m.assignToEvent, { eventId, formId })).rejects.toThrow("Publiser");
	});
	it("keeps exactly one default, including concurrent changes and repeated selection", async () => {
		const { t, client, formId } = await fixture();
		const second = await client.mutation(m.saveDraft, {
			name: "Other",
			fields: defaultFeedbackFields,
		});
		const versionId = await client.mutation(m.publish, { formId });
		await client.mutation(m.publish, { formId: second });
		await client.mutation(m.setDefault, { formId });
		expect(await client.query(q.getDefault, {})).toMatchObject({
			formId,
			publishedVersion: { _id: versionId },
		});
		await client.mutation(m.setDefault, { formId });
		await Promise.all([
			client.mutation(m.setDefault, { formId }),
			client.mutation(m.setDefault, { formId: second }),
		]);
		const defaults = await t.run((ctx) =>
			ctx.db
				.query("feedbackForms")
				.withIndex("by_isDefault", (q) => q.eq("isDefault", true))
				.collect(),
		);
		expect(defaults).toHaveLength(1);
		expect(defaults[0]._id).toBe(second);
	});
	it("paginates metadata without exposing draft fields", async () => {
		const { client, formId } = await fixture();
		await client.mutation(m.publish, { formId });
		for (const name of ["Second", "Third"])
			await client.mutation(m.saveDraft, { name, fields: defaultFeedbackFields });
		const first = await client.query(q.list, { paginationOpts: page });
		expect(first.page).toHaveLength(2);
		expect(first.isDone).toBe(false);
		expect(first.page[0]).not.toHaveProperty("draftFields");
		const next = await client.query(q.list, {
			paginationOpts: { ...page, cursor: first.continueCursor },
		});
		expect(next.page).toHaveLength(1);
		expect(next.page[0].publishedVersion?.formDefinitionId).toBe(formId);
		expect(next.isDone).toBe(true);
	});
	it.each(["super-admin", "admin", "editor", "internal"] as AccessRole[])(
		"allows %s to read published forms and assign events without activating feedback",
		async (role) => {
			const { t, client, formId, eventId } = await fixture();
			const versionId = await client.mutation(m.publish, { formId });
			const user = await insertUser(t, `${role}@example.test`);
			await grantRole(t, user._id, role);
			const actor = asUser(t, user);
			expect((await actor.query(q.list, { paginationOpts: page })).page).toHaveLength(1);
			expect((await actor.query(q.getVersion, { versionId }))._id).toBe(versionId);
			expect(await actor.query(q.getDefault, {})).toBeNull();
			await actor.mutation(m.assignToEvent, { eventId, formId });
			expect(await t.run((ctx) => ctx.db.get(eventId))).toMatchObject({ feedbackFormId: formId });
			expect(await t.run((ctx) => ctx.db.get(eventId))).not.toHaveProperty("feedbackEnabled");
			await t.run((ctx) => ctx.db.patch(eventId, { feedbackEnabled: false }));
			await actor.mutation(m.assignToEvent, { eventId });
			expect(await t.run((ctx) => ctx.db.get(eventId))).not.toHaveProperty("feedbackFormId");
			expect((await t.run((ctx) => ctx.db.get(eventId)))?.feedbackEnabled).toBe(false);
		},
	);
	it.each([null, "admin", "editor", "internal"] as const)(
		"denies %s form editing, publishing and draft reads",
		async (role) => {
			const { t, client, formId } = await fixture();
			await client.mutation(m.publish, { formId });
			const user = await insertUser(t, "other@example.test");
			if (role) await grantRole(t, user._id, role);
			const actor = asUser(t, user);
			await expect(
				actor.mutation(m.saveDraft, { formId, name: "Changed", fields: defaultFeedbackFields }),
			).rejects.toThrow("Unauthorized");
			await expect(actor.mutation(m.publish, { formId })).rejects.toThrow("Unauthorized");
			await expect(actor.mutation(m.setDefault, { formId })).rejects.toThrow("Unauthorized");
			await expect(actor.query(q.getDraft, { formId })).rejects.toThrow("Unauthorized");
		},
	);
	it.each(["anonymous", "student"])("denies %s every management API", async (identity) => {
		const { t, client, formId, eventId } = await fixture();
		const versionId = await client.mutation(m.publish, { formId });
		const actor =
			identity === "anonymous" ? t : asUser(t, await insertUser(t, "student@example.test"));
		await expect(actor.query(q.list, { paginationOpts: page })).rejects.toThrow("Unauthorized");
		await expect(actor.query(q.getVersion, { versionId })).rejects.toThrow("Unauthorized");
		await expect(actor.query(q.getDefault, {})).rejects.toThrow("Unauthorized");
		await expect(actor.query(q.getDraft, { formId })).rejects.toThrow("Unauthorized");
		await expect(actor.mutation(m.assignToEvent, { eventId, formId })).rejects.toThrow(
			"Unauthorized",
		);
		await expect(
			actor.mutation(m.saveDraft, { name: "New", fields: defaultFeedbackFields }),
		).rejects.toThrow("Unauthorized");
		await expect(actor.mutation(m.publish, { formId })).rejects.toThrow("Unauthorized");
		await expect(actor.mutation(m.setDefault, { formId })).rejects.toThrow("Unauthorized");
	});
	it("rejects missing forms, versions and events", async () => {
		const { t, client, formId, eventId } = await fixture();
		const versionId = await client.mutation(m.publish, { formId });
		await t.run(async (ctx) => {
			await ctx.db.delete(formId);
			await ctx.db.delete(versionId);
		});
		await expect(client.query(q.getDraft, { formId })).rejects.toThrow("finnes ikke");
		await expect(client.query(q.getVersion, { versionId })).rejects.toThrow("finnes ikke");
		await expect(
			client.mutation(m.saveDraft, { formId, name: "New", fields: defaultFeedbackFields }),
		).rejects.toThrow("finnes ikke");
		await expect(client.mutation(m.publish, { formId })).rejects.toThrow("finnes ikke");
		await expect(client.mutation(m.setDefault, { formId })).rejects.toThrow("finnes ikke");
		await expect(client.mutation(m.assignToEvent, { eventId, formId })).rejects.toThrow(
			"finnes ikke",
		);
		await t.run((ctx) => ctx.db.delete(eventId));
		await expect(client.mutation(m.assignToEvent, { eventId })).rejects.toThrow("finnes ikke");
	});
	it("preserves feedback configuration when normal event details are edited", async () => {
		const { t, client, formId, eventId } = await fixture();
		await client.mutation(m.publish, { formId });
		await client.mutation(m.assignToEvent, { eventId, formId });
		await t.run((ctx) => ctx.db.patch(eventId, { feedbackEnabled: false }));
		const event = await t.run((ctx) => ctx.db.get(eventId));
		if (!event) throw new Error("Missing fixture");
		const {
			_id,
			_creationTime,
			feedbackEnabled,
			feedbackFormId,
			slug,
			formId: legacyForm,
			...input
		} = event;
		await client.mutation(api.events.mutations.update, {
			...input,
			id: eventId,
			title: "Updated",
			organizers: [],
		});
		expect(await t.run((ctx) => ctx.db.get(eventId))).toMatchObject({
			title: "Updated",
			feedbackEnabled: false,
			feedbackFormId: formId,
		});
		expect(await t.run((ctx) => ctx.db.query("feedbackCampaigns").collect())).toHaveLength(0);
		expect(
			await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
		).toHaveLength(0);
	});
});
