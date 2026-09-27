import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertEvent, insertUser, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { AccessRole } from "../../auth/accessRights";
import { defaultFeedbackFields } from "../defaultFields";

const feedbackMutations = api.feedback.forms.mutations;
const feedbackQueries = api.feedback.forms.queries;
const paginationOptions = { cursor: null, numItems: 2 };
async function setupFormManagement() {
	const { t: backend, companyId } = await setup();
	const user = await insertUser(backend, "owner@example.test");
	await grantRole(backend, user._id, "super-admin");
	const superAdminClient = asUser(backend, user);
	const eventId = await insertEvent(backend, companyId);
	const formId = await superAdminClient.mutation(feedbackMutations.saveDraft, {
		name: "  Feedback  ",
		fields: defaultFeedbackFields,
	});
	return { backend, superAdminClient, user, eventId, formId };
}

describe("feedback form management", () => {
	it("saves normalized drafts and publishes ordered immutable snapshots", async () => {
		const { backend, superAdminClient, user, formId, eventId } = await setupFormManagement();
		expect(await superAdminClient.query(feedbackQueries.getDraft, { formId })).toMatchObject({
			name: "Feedback",
			isDefault: false,
			draftFields: defaultFeedbackFields,
		});
		const versionId = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		const originalVersion = await superAdminClient.query(feedbackQueries.getVersion, { versionId });
		expect(originalVersion).toMatchObject({
			name: "Feedback",
			formDefinitionId: formId,
			createdBy: user._id,
		});
		expect(
			originalVersion.fields.map(({ _id, _creationTime, formVersionId, order, ...field }) => field),
		).toEqual(defaultFeedbackFields);
		expect(originalVersion.fields.map((field) => field.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(await superAdminClient.query(feedbackQueries.getDraft, { formId })).not.toHaveProperty(
			"draftFields",
		);
		const campaignId = await backend.run((ctx) =>
			ctx.db.insert("feedbackCampaigns", {
				eventId,
				formVersionId: versionId,
				status: "open",
				opensAt: 1,
				closesAt: 2,
				generation: 1,
			}),
		);
		await superAdminClient.mutation(feedbackMutations.saveDraft, {
			formId,
			name: "Revised",
			fields: [...defaultFeedbackFields].reverse(),
		});
		expect(await superAdminClient.query(feedbackQueries.getVersion, { versionId })).toEqual(
			originalVersion,
		);
		const revisedVersionId = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		expect(revisedVersionId).not.toBe(versionId);
		expect(
			(
				await superAdminClient.query(feedbackQueries.getVersion, { versionId: revisedVersionId })
			).fields.map((field) => field.key),
		).toEqual(defaultFeedbackFields.map((field) => field.key).reverse());
		expect(await superAdminClient.query(feedbackQueries.getVersion, { versionId })).toEqual(
			originalVersion,
		);
		expect((await backend.run((ctx) => ctx.db.get(campaignId)))?.formVersionId).toBe(versionId);
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
		const { superAdminClient, formId } = await setupFormManagement();
		const originalDraft = await superAdminClient.query(feedbackQueries.getDraft, { formId });
		await expect(
			superAdminClient.mutation(feedbackMutations.saveDraft, { formId, ...input }),
		).rejects.toThrow();
		expect(await superAdminClient.query(feedbackQueries.getDraft, { formId })).toEqual(
			originalDraft,
		);
	});
	it("cannot publish absent or corrupt drafts", async () => {
		const { backend, superAdminClient, formId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await expect(superAdminClient.mutation(feedbackMutations.publish, { formId })).rejects.toThrow(
			"gyldig utkast",
		);
		await backend.run((ctx) => ctx.db.patch(formId, { draftFields: [] }));
		await expect(superAdminClient.mutation(feedbackMutations.publish, { formId })).rejects.toThrow(
			"gyldig utkast",
		);
		expect(await backend.run((ctx) => ctx.db.query("formVersions").collect())).toHaveLength(1);
	});
	it("publishes a draft only once under concurrent requests", async () => {
		const { backend, superAdminClient, formId } = await setupFormManagement();
		const publicationResults = await Promise.allSettled([
			superAdminClient.mutation(feedbackMutations.publish, { formId }),
			superAdminClient.mutation(feedbackMutations.publish, { formId }),
		]);
		expect(
			publicationResults.filter((publicationResult) => publicationResult.status === "fulfilled"),
		).toHaveLength(1);
		expect(await backend.run((ctx) => ctx.db.query("formVersions").collect())).toHaveLength(1);
		expect(await backend.run((ctx) => ctx.db.query("formFields").collect())).toHaveLength(8);
	});
	it("requires a published version for defaults and assignment", async () => {
		const { superAdminClient, formId, eventId } = await setupFormManagement();
		expect(await superAdminClient.query(feedbackQueries.getDefault, {})).toBeNull();
		await expect(
			superAdminClient.mutation(feedbackMutations.setDefault, { formId }),
		).rejects.toThrow("Publiser");
		await expect(
			superAdminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId,
				enabled: false,
				formId,
			}),
		).rejects.toThrow("publisert");
	});
	it("keeps exactly one default, including concurrent changes and repeated selection", async () => {
		const { backend, superAdminClient, formId } = await setupFormManagement();
		const secondFormId = await superAdminClient.mutation(feedbackMutations.saveDraft, {
			name: "Other",
			fields: defaultFeedbackFields,
		});
		const versionId = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await superAdminClient.mutation(feedbackMutations.publish, { formId: secondFormId });
		await superAdminClient.mutation(feedbackMutations.setDefault, { formId });
		expect(await superAdminClient.query(feedbackQueries.getDefault, {})).toMatchObject({
			formId,
			publishedVersion: { _id: versionId },
		});
		await superAdminClient.mutation(feedbackMutations.setDefault, { formId });
		await Promise.all([
			superAdminClient.mutation(feedbackMutations.setDefault, { formId }),
			superAdminClient.mutation(feedbackMutations.setDefault, { formId: secondFormId }),
		]);
		const defaultForms = await backend.run((ctx) =>
			ctx.db
				.query("feedbackForms")
				.withIndex("by_isDefault", (index) => index.eq("isDefault", true))
				.collect(),
		);
		expect(defaultForms).toHaveLength(1);
		expect([formId, secondFormId]).toContain(defaultForms[0]._id);
		await superAdminClient.mutation(feedbackMutations.setDefault, { formId: secondFormId });
		expect(await superAdminClient.query(feedbackQueries.getDefault, {})).toMatchObject({
			formId: secondFormId,
		});
	});
	it("paginates metadata without exposing draft fields", async () => {
		const { superAdminClient, formId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		for (const name of ["Second", "Third"])
			await superAdminClient.mutation(feedbackMutations.saveDraft, {
				name,
				fields: defaultFeedbackFields,
			});
		const firstPage = await superAdminClient.query(feedbackQueries.getFeedbackForms, {
			paginationOpts: paginationOptions,
		});
		expect(firstPage.page).toHaveLength(2);
		expect(firstPage.isDone).toBe(false);
		expect(firstPage.page[0]).not.toHaveProperty("draftFields");
		expect(firstPage.page[0]).toMatchObject({ isHidden: false, hasDraft: true });
		expect(firstPage.page[1]).toMatchObject({ isHidden: false, hasDraft: true });
		const nextPage = await superAdminClient.query(feedbackQueries.getFeedbackForms, {
			paginationOpts: { ...paginationOptions, cursor: firstPage.continueCursor },
		});
		expect(nextPage.page).toHaveLength(1);
		expect(nextPage.page[0].publishedVersion?.formDefinitionId).toBe(formId);
		expect(nextPage.page[0]).toMatchObject({ isHidden: false, hasDraft: false });
		expect(nextPage.isDone).toBe(true);
	});
	it("hides and shows a non-default form, and reports isHidden through getFeedbackForms", async () => {
		const { superAdminClient, formId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await superAdminClient.mutation(feedbackMutations.setHidden, { formId, isHidden: true });
		const hiddenPage = await superAdminClient.query(feedbackQueries.getFeedbackForms, {
			paginationOpts: { cursor: null, numItems: 10 },
		});
		expect(hiddenPage.page.find((form) => form._id === formId)).toMatchObject({ isHidden: true });
		await superAdminClient.mutation(feedbackMutations.setHidden, { formId, isHidden: false });
		const visiblePage = await superAdminClient.query(feedbackQueries.getFeedbackForms, {
			paginationOpts: { cursor: null, numItems: 10 },
		});
		expect(visiblePage.page.find((form) => form._id === formId)).toMatchObject({ isHidden: false });
	});
	it("refuses to hide the default form and refuses to default a hidden form", async () => {
		const { superAdminClient, formId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await superAdminClient.mutation(feedbackMutations.setDefault, { formId });
		await expect(
			superAdminClient.mutation(feedbackMutations.setHidden, { formId, isHidden: true }),
		).rejects.toThrow("kan ikke skjules");
		const secondFormId = await superAdminClient.mutation(feedbackMutations.saveDraft, {
			name: "Other",
			fields: defaultFeedbackFields,
		});
		await superAdminClient.mutation(feedbackMutations.publish, { formId: secondFormId });
		await superAdminClient.mutation(feedbackMutations.setHidden, {
			formId: secondFormId,
			isHidden: true,
		});
		await expect(
			superAdminClient.mutation(feedbackMutations.setDefault, { formId: secondFormId }),
		).rejects.toThrow("Vis skjemaet");
	});
	it("refuses a non-admin caller of setHidden", async () => {
		const { backend, superAdminClient, formId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		const user = await insertUser(backend, "editor-user@example.test");
		await grantRole(backend, user._id, "editor");
		await expect(
			asUser(backend, user).mutation(feedbackMutations.setHidden, { formId, isHidden: true }),
		).rejects.toThrow("Unauthorized");
	});
	it("blocks assigning a hidden, non-current form to an event but allows keeping the current one", async () => {
		const { backend, superAdminClient, formId, eventId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await superAdminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
			eventId,
			enabled: false,
			formId,
		});
		await superAdminClient.mutation(feedbackMutations.setHidden, { formId, isHidden: true });
		await superAdminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
			eventId,
			enabled: false,
			formId,
		});
		const secondFormId = await superAdminClient.mutation(feedbackMutations.saveDraft, {
			name: "Other",
			fields: defaultFeedbackFields,
		});
		await superAdminClient.mutation(feedbackMutations.publish, { formId: secondFormId });
		await superAdminClient.mutation(feedbackMutations.setHidden, {
			formId: secondFormId,
			isHidden: true,
		});
		await expect(
			superAdminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId,
				enabled: false,
				formId: secondFormId,
			}),
		).rejects.toThrow("synlig skjema");
		expect(await backend.run((ctx) => ctx.db.get(eventId))).toMatchObject({
			feedbackFormId: formId,
		});
	});
	it("lists versions newest first with a 1-based number, oldest at 1 (bounded to the newest 100 versions)", async () => {
		const { superAdminClient, formId } = await setupFormManagement();
		const versionId1 = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await superAdminClient.mutation(feedbackMutations.saveDraft, {
			formId,
			name: "Feedback",
			fields: defaultFeedbackFields,
		});
		const versionId2 = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await superAdminClient.mutation(feedbackMutations.saveDraft, {
			formId,
			name: "Feedback",
			fields: defaultFeedbackFields,
		});
		const versionId3 = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		const versions = await superAdminClient.query(feedbackQueries.getVersions, { formId });
		expect(versions).toEqual([
			{ _id: versionId3, publishedAt: expect.any(Number), number: 3 },
			{ _id: versionId2, publishedAt: expect.any(Number), number: 2 },
			{ _id: versionId1, publishedAt: expect.any(Number), number: 1 },
		]);
	});
	it("denies non-internal callers of getVersions", async () => {
		const { backend, superAdminClient, formId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		const user = await insertUser(backend, "student-getversions@example.test");
		await expect(
			asUser(backend, user).query(feedbackQueries.getVersions, { formId }),
		).rejects.toThrow("Unauthorized");
	});
	it.each(["super-admin", "admin", "editor", "internal"] as AccessRole[])(
		"allows %s to read published forms and assign events without activating feedback",
		async (role) => {
			const { backend, superAdminClient, formId, eventId } = await setupFormManagement();
			const versionId = await superAdminClient.mutation(feedbackMutations.publish, { formId });
			const user = await insertUser(backend, `${role}@example.test`);
			await grantRole(backend, user._id, role);
			const requestClient = asUser(backend, user);
			expect(
				(
					await requestClient.query(feedbackQueries.getFeedbackForms, {
						paginationOpts: paginationOptions,
					})
				).page,
			).toHaveLength(1);
			expect((await requestClient.query(feedbackQueries.getVersion, { versionId }))._id).toBe(
				versionId,
			);
			expect(await requestClient.query(feedbackQueries.getDefault, {})).toBeNull();
			await requestClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId,
				enabled: false,
				formId,
			});
			expect(await backend.run((ctx) => ctx.db.get(eventId))).toMatchObject({
				feedbackFormId: formId,
			});
			await requestClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId,
				enabled: false,
			});
			expect(await backend.run((ctx) => ctx.db.get(eventId))).not.toHaveProperty("feedbackFormId");
			expect((await backend.run((ctx) => ctx.db.get(eventId)))?.feedbackEnabled).toBe(false);
		},
	);
	it("lets an admin edit, publish and read drafts", async () => {
		const { backend, formId } = await setupFormManagement();
		const user = await insertUser(backend, "admin-user@example.test");
		await grantRole(backend, user._id, "admin");
		const adminClient = asUser(backend, user);
		await adminClient.mutation(feedbackMutations.saveDraft, {
			formId,
			name: "Changed",
			fields: defaultFeedbackFields,
		});
		await adminClient.mutation(feedbackMutations.publish, { formId });
		await adminClient.mutation(feedbackMutations.setDefault, { formId });
		expect(await adminClient.query(feedbackQueries.getDraft, { formId })).toMatchObject({
			name: "Changed",
			isDefault: true,
		});
	});
	it.each([null, "editor", "internal"] as const)(
		"denies %s form editing, publishing and draft reads",
		async (role) => {
			const { backend, superAdminClient, formId } = await setupFormManagement();
			await superAdminClient.mutation(feedbackMutations.publish, { formId });
			const user = await insertUser(backend, "other@example.test");
			if (role) await grantRole(backend, user._id, role);
			const requestClient = asUser(backend, user);
			await expect(
				requestClient.mutation(feedbackMutations.saveDraft, {
					formId,
					name: "Changed",
					fields: defaultFeedbackFields,
				}),
			).rejects.toThrow("Unauthorized");
			await expect(requestClient.mutation(feedbackMutations.publish, { formId })).rejects.toThrow(
				"Unauthorized",
			);
			await expect(
				requestClient.mutation(feedbackMutations.setDefault, { formId }),
			).rejects.toThrow("Unauthorized");
			await expect(requestClient.query(feedbackQueries.getDraft, { formId })).rejects.toThrow(
				"Unauthorized",
			);
		},
	);
	it.each(["anonymous", "student"])("denies %s every management API", async (identity) => {
		const { backend, superAdminClient, formId, eventId } = await setupFormManagement();
		const versionId = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		const requestClient =
			identity === "anonymous"
				? backend
				: asUser(backend, await insertUser(backend, "student@example.test"));
		await expect(
			requestClient.query(feedbackQueries.getFeedbackForms, { paginationOpts: paginationOptions }),
		).rejects.toThrow("Unauthorized");
		await expect(requestClient.query(feedbackQueries.getVersion, { versionId })).rejects.toThrow(
			"Unauthorized",
		);
		await expect(requestClient.query(feedbackQueries.getDefault, {})).rejects.toThrow(
			"Unauthorized",
		);
		await expect(requestClient.query(feedbackQueries.getDraft, { formId })).rejects.toThrow(
			"Unauthorized",
		);
		await expect(
			requestClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId,
				enabled: false,
				formId,
			}),
		).rejects.toThrow("Unauthorized");
		await expect(
			requestClient.mutation(feedbackMutations.saveDraft, {
				name: "New",
				fields: defaultFeedbackFields,
			}),
		).rejects.toThrow("Unauthorized");
		await expect(requestClient.mutation(feedbackMutations.publish, { formId })).rejects.toThrow(
			"Unauthorized",
		);
		await expect(requestClient.mutation(feedbackMutations.setDefault, { formId })).rejects.toThrow(
			"Unauthorized",
		);
	});
	it("rejects missing forms, versions and events", async () => {
		const { backend, superAdminClient, formId, eventId } = await setupFormManagement();
		const versionId = await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await backend.run(async (ctx) => {
			await ctx.db.delete(formId);
			await ctx.db.delete(versionId);
		});
		await expect(superAdminClient.query(feedbackQueries.getDraft, { formId })).rejects.toThrow(
			"finnes ikke",
		);
		await expect(superAdminClient.query(feedbackQueries.getVersion, { versionId })).rejects.toThrow(
			"finnes ikke",
		);
		await expect(
			superAdminClient.mutation(feedbackMutations.saveDraft, {
				formId,
				name: "New",
				fields: defaultFeedbackFields,
			}),
		).rejects.toThrow("finnes ikke");
		await expect(superAdminClient.mutation(feedbackMutations.publish, { formId })).rejects.toThrow(
			"finnes ikke",
		);
		await expect(
			superAdminClient.mutation(feedbackMutations.setDefault, { formId }),
		).rejects.toThrow("finnes ikke");
		await expect(
			superAdminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId,
				enabled: false,
				formId,
			}),
		).rejects.toThrow("finnes ikke");
		await backend.run((ctx) => ctx.db.delete(eventId));
		await expect(
			superAdminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId,
				enabled: false,
			}),
		).rejects.toThrow("finnes ikke");
	});
	it("preserves feedback configuration when normal event details are edited", async () => {
		const { backend, superAdminClient, formId, eventId } = await setupFormManagement();
		await superAdminClient.mutation(feedbackMutations.publish, { formId });
		await superAdminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
			eventId,
			enabled: false,
			formId,
		});
		const event = await backend.run((ctx) => ctx.db.get(eventId));
		if (!event) throw new Error("Missing fixture");
		const {
			_id,
			_creationTime,
			feedbackEnabled,
			feedbackFormId,
			slug,
			formId: legacyFormId,
			...eventDetails
		} = event;
		await superAdminClient.mutation(api.events.mutations.update, {
			...eventDetails,
			id: eventId,
			title: "Updated",
			organizers: [],
		});
		expect(await backend.run((ctx) => ctx.db.get(eventId))).toMatchObject({
			title: "Updated",
			feedbackEnabled: false,
			feedbackFormId: formId,
		});
		expect(await backend.run((ctx) => ctx.db.query("feedbackCampaigns").collect())).toHaveLength(0);
		expect(
			await backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
		).toHaveLength(0);
	});
});
