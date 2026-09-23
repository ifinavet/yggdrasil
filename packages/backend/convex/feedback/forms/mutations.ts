import { feedbackFormSchema } from "@workspace/shared/feedback";
import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import { internalRoles, requireRole, superAdminRoles } from "../../auth/accessRights";
import { feedbackField } from "../schema";
import { getFormOrThrow, latestVersion } from "./helpers";

export const saveDraft = mutation({
	args: {
		formId: v.optional(v.id("feedbackForms")),
		name: v.string(),
		fields: v.array(feedbackField),
	},
	handler: async (ctx, { formId, ...input }) => {
		await requireRole(ctx, superAdminRoles);
		const result = feedbackFormSchema.safeParse(input);
		if (!result.success)
			throw new ConvexError(result.error.issues.map((issue) => issue.message).join("\n"));
		const { name, fields: draftFields } = result.data;
		if (formId) {
			await getFormOrThrow(ctx, formId);
			await ctx.db.patch(formId, { name, draftFields });
			return formId;
		}
		return await ctx.db.insert("feedbackForms", { name, draftFields, isDefault: false });
	},
});

export const publish = mutation({
	args: { formId: v.id("feedbackForms") },
	handler: async (ctx, { formId }) => {
		const user = await requireRole(ctx, superAdminRoles);
		const form = await getFormOrThrow(ctx, formId);
		const result = feedbackFormSchema.safeParse({ name: form.name, fields: form.draftFields });
		if (!result.success) throw new ConvexError("Lagre et gyldig utkast før publisering.");
		const versionId = await ctx.db.insert("formVersions", {
			formDefinitionId: formId,
			name: result.data.name,
			publishedAt: Date.now(),
			createdBy: user._id,
		});
		await Promise.all(
			result.data.fields.map((field, order) =>
				ctx.db.insert("formFields", { ...field, order, formVersionId: versionId }),
			),
		);
		await ctx.db.patch(formId, { draftFields: undefined });
		return versionId;
	},
});

export const setDefault = mutation({
	args: { formId: v.id("feedbackForms") },
	handler: async (ctx, { formId }) => {
		await requireRole(ctx, superAdminRoles);
		await getFormOrThrow(ctx, formId);
		if (!(await latestVersion(ctx, formId)))
			throw new ConvexError("Publiser skjemaet før det settes som standard.");
		const previous = await ctx.db
			.query("feedbackForms")
			.withIndex("by_isDefault", (q) => q.eq("isDefault", true))
			.unique();
		if (previous) await ctx.db.patch(previous._id, { isDefault: false });
		await ctx.db.patch(formId, { isDefault: true });
	},
});

/** Sets the form for future campaigns; published campaign snapshots are unchanged. */
export const assignToEvent = mutation({
	args: { eventId: v.id("events"), formId: v.optional(v.id("feedbackForms")) },
	handler: async (ctx, { eventId, formId }) => {
		await requireRole(ctx, internalRoles);
		if (!(await ctx.db.get(eventId))) throw new ConvexError("Arrangementet finnes ikke.");
		if (formId) {
			await getFormOrThrow(ctx, formId);
			if (!(await latestVersion(ctx, formId)))
				throw new ConvexError("Publiser skjemaet før det brukes på et arrangement.");
		}
		await ctx.db.patch(eventId, { feedbackFormId: formId });
	},
});
