import { feedbackFormSchema } from "@workspace/shared/feedback";
import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import { internalRoles, requireRole, superAdminRoles } from "../../auth/accessRights";
import { syncFeedbackCampaign } from "../delivery/campaigns";
import { feedbackField } from "../schema";
import {
	getFeedbackFormOrThrow,
	getLatestPublishedVersion,
	insertFormVersion,
	markFormAsDefault,
} from "./helpers";

export const saveDraft = mutation({
	args: {
		formId: v.optional(v.id("feedbackForms")),
		name: v.string(),
		fields: v.array(feedbackField),
	},
	handler: async (ctx, { formId, ...draftInput }) => {
		await requireRole(ctx, superAdminRoles);
		const validationResult = feedbackFormSchema.safeParse(draftInput);
		if (!validationResult.success)
			throw new ConvexError(validationResult.error.issues.map((issue) => issue.message).join("\n"));
		const { name, fields: draftFields } = validationResult.data;
		if (formId) {
			await getFeedbackFormOrThrow(ctx, formId);
			await ctx.db.patch(formId, { name, draftFields });
			return formId;
		}
		return await ctx.db.insert("feedbackForms", { name, draftFields, isDefault: false });
	},
});

export const publish = mutation({
	args: { formId: v.id("feedbackForms") },
	handler: async (ctx, { formId }) => {
		const publisher = await requireRole(ctx, superAdminRoles);
		const feedbackForm = await getFeedbackFormOrThrow(ctx, formId);
		const validationResult = feedbackFormSchema.safeParse({
			name: feedbackForm.name,
			fields: feedbackForm.draftFields,
		});
		if (!validationResult.success) throw new ConvexError("Lagre et gyldig utkast før publisering.");
		const versionId = await insertFormVersion(ctx, {
			formId,
			...validationResult.data,
			createdBy: publisher._id,
		});
		await ctx.db.patch(formId, { draftFields: undefined });
		return versionId;
	},
});

export const setDefault = mutation({
	args: { formId: v.id("feedbackForms") },
	handler: async (ctx, { formId }) => {
		await requireRole(ctx, superAdminRoles);
		await getFeedbackFormOrThrow(ctx, formId);
		if (!(await getLatestPublishedVersion(ctx, formId)))
			throw new ConvexError("Publiser skjemaet før det settes som standard.");
		await markFormAsDefault(ctx, formId);
	},
});

/** Sets the form for future campaigns; published campaign snapshots are unchanged. */
export const assignToEvent = mutation({
	args: { eventId: v.id("events"), formId: v.optional(v.id("feedbackForms")) },
	handler: async (ctx, { eventId, formId }) => {
		await requireRole(ctx, internalRoles);
		if (!(await ctx.db.get(eventId))) throw new ConvexError("Arrangementet finnes ikke.");
		if (formId) {
			await getFeedbackFormOrThrow(ctx, formId);
			if (!(await getLatestPublishedVersion(ctx, formId)))
				throw new ConvexError("Publiser skjemaet før det brukes på et arrangement.");
		}
		await ctx.db.patch(eventId, { feedbackFormId: formId });
		await syncFeedbackCampaign(ctx, eventId);
	},
});
