import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertEvent, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";
import { internalRoles } from "../auth/accessRights";
import { defaultFeedbackFields } from "./defaultFields";

async function setupSettings() {
	const { t: backend, companyId } = await setup();
	const user = await insertUser(backend, "settings-owner@example.test");
	await grantRole(backend, user._id, "super-admin");
	const client = asUser(backend, user);
	const eventId = await insertEvent(backend, companyId);
	const formId = await client.mutation(api.feedback.forms.mutations.saveDraft, {
		name: "Feedback",
		fields: defaultFeedbackFields,
	});
	return { backend, client, eventId, formId };
}
const { getEventFeedbackSettings, updateEventFeedbackSettings } = api.feedback.events;
describe("event feedback settings", () => {
	it("keeps legacy events disabled and allows saving off without a default", async () => {
		const { backend, client, eventId } = await setupSettings();
		expect(await client.query(getEventFeedbackSettings, { eventId })).toEqual({
			enabled: false,
			campaignStatus: null,
			locked: false,
		});
		await client.mutation(updateEventFeedbackSettings, { eventId, enabled: false });
		expect(await backend.run((ctx) => ctx.db.get(eventId))).toMatchObject({
			feedbackEnabled: false,
		});
		expect(await backend.run((ctx) => ctx.db.query("feedbackCampaigns").collect())).toEqual([]);
		expect(
			await backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
		).toEqual([]);
	});
	it("saves a published override and enabled state atomically, then clears both", async () => {
		const { backend, client, eventId, formId } = await setupSettings();
		await client.mutation(api.feedback.forms.mutations.publish, { formId });
		await client.mutation(updateEventFeedbackSettings, { eventId, enabled: true, formId });
		expect(await client.query(getEventFeedbackSettings, { eventId })).toEqual({
			enabled: true,
			formId,
			selectedFormName: "Feedback",
			campaignStatus: "scheduled",
			locked: false,
		});
		await client.mutation(updateEventFeedbackSettings, { eventId, enabled: false });
		expect(await client.query(getEventFeedbackSettings, { eventId })).toEqual({
			enabled: false,
			campaignStatus: "cancelled",
			locked: false,
		});
		expect(await backend.run((ctx) => ctx.db.query("feedbackDeliveries").collect())).toEqual([]);
	});
	it("requires a published default before enabling without an override", async () => {
		const { backend, client, eventId, formId } = await setupSettings();
		await expect(
			client.mutation(updateEventFeedbackSettings, { eventId, enabled: true }),
		).rejects.toThrow("standardskjema");
		await backend.run((ctx) => ctx.db.patch(formId, { isDefault: true }));
		await expect(
			client.mutation(updateEventFeedbackSettings, { eventId, enabled: true }),
		).rejects.toThrow("standardskjema");
		await client.mutation(api.feedback.forms.mutations.publish, { formId });
		await client.mutation(updateEventFeedbackSettings, { eventId, enabled: true });
		expect(await client.query(getEventFeedbackSettings, { eventId })).toEqual({
			enabled: true,
			campaignStatus: "scheduled",
			locked: false,
		});
	});
	it("rejects unpublished and missing overrides without changing the saved flag", async () => {
		const { backend, client, eventId, formId } = await setupSettings();
		await expect(
			client.mutation(updateEventFeedbackSettings, { eventId, enabled: true, formId }),
		).rejects.toThrow("publisert");
		await backend.run((ctx) => ctx.db.delete(formId));
		await expect(
			client.mutation(updateEventFeedbackSettings, { eventId, enabled: true, formId }),
		).rejects.toThrow();
		expect(await client.query(getEventFeedbackSettings, { eventId })).toEqual({
			enabled: false,
			campaignStatus: null,
			locked: false,
		});
	});
	it("rejects missing events for reads and writes", async () => {
		const { backend, client, eventId } = await setupSettings();
		await backend.run((ctx) => ctx.db.delete(eventId));
		await expect(client.query(getEventFeedbackSettings, { eventId })).rejects.toThrow(
			"finnes ikke",
		);
		await expect(
			client.mutation(updateEventFeedbackSettings, { eventId, enabled: false }),
		).rejects.toThrow("finnes ikke");
	});
	it.each(internalRoles)("allows %s to read and update settings", async (role) => {
		const { backend, eventId } = await setupSettings();
		const user = await insertUser(backend, `${role}@example.test`);
		await grantRole(backend, user._id, role);
		const client = asUser(backend, user);
		await client.mutation(updateEventFeedbackSettings, { eventId, enabled: false });
		expect((await client.query(getEventFeedbackSettings, { eventId })).enabled).toBe(false);
	});
	it("rejects anonymous users and students", async () => {
		const { backend, eventId } = await setupSettings();
		const student = await insertUser(backend, "student@example.test");
		for (const client of [backend, asUser(backend, student)]) {
			await expect(client.query(getEventFeedbackSettings, { eventId })).rejects.toThrow();
			await expect(
				client.mutation(updateEventFeedbackSettings, { eventId, enabled: false }),
			).rejects.toThrow();
		}
	});
	it.each(["scheduled", "closed", "cancelled"] as const)(
		"shows the latest %s campaign and lets feedback be turned off",
		async (status) => {
			const { backend, client, eventId } = await setupSettings();
			const campaignId = await backend.run((ctx) =>
				ctx.db.insert("feedbackCampaigns", {
					eventId,
					status,
					opensAt: 1,
					closesAt: 2,
					generation: 1,
				}),
			);
			const original = await backend.run((ctx) => ctx.db.get(campaignId));
			expect(await client.query(getEventFeedbackSettings, { eventId })).toMatchObject({
				campaignStatus: status,
				locked: false,
			});
			await client.mutation(updateEventFeedbackSettings, { eventId, enabled: false });
			expect(await backend.run((ctx) => ctx.db.get(campaignId))).toMatchObject({
				...original,
				status: status === "scheduled" ? "cancelled" : status,
			});
		},
	);
	it.each(["open", "scheduled with a manually sent form"] as const)(
		"refuses to turn feedback off once a %s campaign has sent forms",
		async (kind) => {
			const { backend, client, eventId, formId } = await setupSettings();
			const formVersionId = await client.mutation(api.feedback.forms.mutations.publish, {
				formId,
			});
			await client.mutation(updateEventFeedbackSettings, { eventId, enabled: true, formId });
			const campaignId = await backend.run(async (ctx) => {
				const id = await ctx.db.insert("feedbackCampaigns", {
					eventId,
					status: kind === "open" ? "open" : "scheduled",
					formVersionId: kind === "open" ? formVersionId : undefined,
					opensAt: 1,
					closesAt: 2,
					generation: 1,
				});
				if (kind !== "open")
					await ctx.db.insert("feedbackInvites", {
						campaignId: id,
						responded: false,
						bounced: false,
						complained: false,
						sent: true,
						delivered: false,
					});
				return id;
			});
			const original = await backend.run((ctx) => ctx.db.get(campaignId));
			expect((await client.query(getEventFeedbackSettings, { eventId })).locked).toBe(true);
			await expect(
				client.mutation(updateEventFeedbackSettings, { eventId, enabled: false }),
			).rejects.toThrow("allerede sendt ut");
			await expect(
				client.mutation(updateEventFeedbackSettings, { eventId, enabled: true }),
			).rejects.toThrow("kan ikke byttes");
			expect(await backend.run((ctx) => ctx.db.get(campaignId))).toEqual(original);
			expect((await client.query(getEventFeedbackSettings, { eventId })).enabled).toBe(true);
			await client.mutation(updateEventFeedbackSettings, { eventId, enabled: true, formId });
			expect(await client.query(getEventFeedbackSettings, { eventId })).toMatchObject({
				enabled: true,
				formId,
				locked: true,
			});
		},
	);
	it("reads settings even if an old selected form no longer exists", async () => {
		const { backend, client, eventId, formId } = await setupSettings();
		await backend.run(async (ctx) => {
			await ctx.db.patch(eventId, { feedbackFormId: formId });
			await ctx.db.delete(formId);
		});
		expect(await client.query(getEventFeedbackSettings, { eventId })).toEqual({
			enabled: false,
			formId,
			campaignStatus: null,
			locked: false,
		});
	});
});
