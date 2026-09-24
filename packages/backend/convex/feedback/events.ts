import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { hasSentForms, latestCampaign, syncFeedbackCampaign } from "./delivery/campaigns";
import { getFeedbackFormOrThrow, getLatestPublishedVersion } from "./forms/helpers";

export const getEventFeedbackSettings = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Arrangementet finnes ikke.");
		const [selectedForm, campaign] = await Promise.all([
			event.feedbackFormId ? ctx.db.get(event.feedbackFormId) : null,
			latestCampaign(ctx, eventId),
		]);
		// Older events have no stored flag. Requiring an explicit true keeps them off after deployment.
		return {
			enabled: event.feedbackEnabled === true,
			formId: event.feedbackFormId,
			selectedFormName: selectedForm?.name,
			campaignStatus: campaign?.status ?? null,
			locked: campaign ? await hasSentForms(ctx, campaign) : false,
		};
	},
});

export const updateEventFeedbackSettings = mutation({
	args: {
		eventId: v.id("events"),
		enabled: v.boolean(),
		formId: v.optional(v.id("feedbackForms")),
	},
	handler: async (ctx, { eventId, enabled, formId }) => {
		await requireRole(ctx, internalRoles);
		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Arrangementet finnes ikke.");
		const campaign = await latestCampaign(ctx, eventId);
		if (campaign && (await hasSentForms(ctx, campaign))) {
			if (!enabled)
				throw new ConvexError(
					"Skjemaet er allerede sendt ut, så tilbakemeldinger kan ikke slås av for dette arrangementet.",
				);
			if (formId !== event.feedbackFormId)
				throw new ConvexError("Skjemaet er allerede sendt ut, så det kan ikke byttes.");
		}
		if (formId) {
			await getFeedbackFormOrThrow(ctx, formId);
			if (!(await getLatestPublishedVersion(ctx, formId)))
				throw new ConvexError("Velg et publisert skjema.");
		} else if (enabled) {
			const defaultForm = await ctx.db
				.query("feedbackForms")
				.withIndex("by_isDefault", (index) => index.eq("isDefault", true))
				.unique();
			if (!defaultForm || !(await getLatestPublishedVersion(ctx, defaultForm._id)))
				throw new ConvexError("Publiser og velg et standardskjema før tilbakemeldinger slås på.");
		}
		await ctx.db.patch(eventId, { feedbackEnabled: enabled, feedbackFormId: formId });
		await syncFeedbackCampaign(ctx, eventId, { requireSchedule: enabled });
	},
});
