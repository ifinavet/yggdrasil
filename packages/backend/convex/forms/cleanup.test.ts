import { expect, it, vi } from "vitest";
import { insertEvent, setup } from "../../test/fixtures";
import { internal } from "../_generated/api";

const deleteLegacyResponses = internal.forms.cleanup.deleteLegacyResponses;

it("deletes legacy responses across batches and keeps current responses", async () => {
	vi.useFakeTimers();
	try {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const current = await t.run(async (ctx) => {
			for (let i = 0; i < 250; i++) {
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
		await t.mutation(deleteLegacyResponses, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const remaining = await t.run((ctx) => ctx.db.query("formResponses").collect());
		expect(remaining.map((row) => row._id)).toEqual([current]);
	} finally {
		vi.useRealTimers();
	}
});

it("does nothing when no responses exist", async () => {
	const { t } = await setup();
	await t.mutation(deleteLegacyResponses, { cursor: null });
	expect(await t.run((ctx) => ctx.db.query("formResponses").collect())).toEqual([]);
});
