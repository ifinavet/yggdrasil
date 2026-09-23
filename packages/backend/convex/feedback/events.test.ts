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
		});
		await client.mutation(updateEventFeedbackSettings, { eventId, enabled: false });
		expect(await client.query(getEventFeedbackSettings, { eventId })).toEqual({
			enabled: false,
			campaignStatus: "cancelled",
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
	it.each(["scheduled", "open", "closed", "cancelled"] as const)(
		"shows the latest %s campaign without changing it",
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
			expect((await client.query(getEventFeedbackSettings, { eventId })).campaignStatus).toBe(
				status,
			);
			await client.mutation(updateEventFeedbackSettings, { eventId, enabled: false });
			expect(await backend.run((ctx) => ctx.db.get(campaignId))).toMatchObject({
				...original,
				status: status === "open" || status === "scheduled" ? "cancelled" : status,
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
		});
	});
});
