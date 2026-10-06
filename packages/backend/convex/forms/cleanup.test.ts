import type { AnyDataModel, GenericDatabaseWriter } from "convex/server";
import { expect, it } from "vitest";
import { insertEvent, setup } from "../../test/fixtures";
import { internal } from "../_generated/api";

const deleteLegacyBatch = internal.forms.cleanup.deleteLegacyBatch;

it("deletes legacy responses and forms across calls and keeps current responses", async () => {
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId);
	const current = await t.run(async (ctx) => {
		const schemalessDb = ctx.db as unknown as GenericDatabaseWriter<AnyDataModel>;
		for (let i = 0; i < 3; i++) {
			await schemalessDb.insert("form", { title: `Form ${i}` });
		}
		for (let i = 0; i < 650; i++) {
			await ctx.db.insert("formResponses", {
				formId: "legacy-form",
				userId: `user_${i}`,
				data: { rating: 5 },
			});
		}
		const campaignId = await ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "open",
			opensAt: 0,
			closesAt: 1,
			generation: 0,
		});
		const formDefinitionId = await ctx.db.insert("feedbackForms", {
			name: "Form",
			isDefault: false,
		});
		const formVersionId = await ctx.db.insert("formVersions", {
			formDefinitionId,
			name: "v1",
			publishedAt: 0,
		});
		const inviteId = await ctx.db.insert("feedbackInvites", {
			campaignId,
			responded: true,
			bounced: false,
			complained: false,
			delivered: true,
			sent: true,
		});
		return ctx.db.insert("formResponses", {
			campaignId,
			formVersionId,
			inviteId,
			data: { rating: 4 },
			submittedAt: 1,
		});
	});

	expect(await t.mutation(deleteLegacyBatch, {})).toEqual({
		deletedResponses: 500,
		deletedForms: 3,
		done: false,
	});
	expect(await t.mutation(deleteLegacyBatch, {})).toEqual({
		deletedResponses: 150,
		deletedForms: 0,
		done: true,
	});
	expect(await t.mutation(deleteLegacyBatch, {})).toEqual({
		deletedResponses: 0,
		deletedForms: 0,
		done: true,
	});

	const remaining = await t.run(async (ctx) => {
		const schemalessDb = ctx.db as unknown as GenericDatabaseWriter<AnyDataModel>;
		return {
			responses: await ctx.db.query("formResponses").collect(),
			forms: await schemalessDb.query("form").collect(),
		};
	});
	expect(remaining.responses.map((row) => row._id)).toEqual([current]);
	expect(remaining.forms).toEqual([]);
});
