import type { FeedbackField } from "@workspace/shared/feedback";
import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export async function getFeedbackFormOrThrow(ctx: QueryCtx, formId: Id<"feedbackForms">) {
	const feedbackForm = await ctx.db.get(formId);
	if (!feedbackForm) throw new ConvexError("Skjemaet finnes ikke.");
	return feedbackForm;
}

export async function getLatestPublishedVersion(ctx: QueryCtx, formId: Id<"feedbackForms">) {
	return await ctx.db
		.query("formVersions")
		.withIndex("by_formDefinitionId_and_publishedAt", (index) =>
			index.eq("formDefinitionId", formId),
		)
		.order("desc")
		.first();
}

export async function insertFormVersion(
	ctx: MutationCtx,
	{
		formId,
		name,
		fields,
		createdBy,
	}: { formId: Id<"feedbackForms">; name: string; fields: FeedbackField[]; createdBy: Id<"users"> },
) {
	const versionId = await ctx.db.insert("formVersions", {
		formDefinitionId: formId,
		name,
		publishedAt: Date.now(),
		createdBy,
	});
	await Promise.all(
		fields.map((field, order) =>
			ctx.db.insert("formFields", { ...field, order, formVersionId: versionId }),
		),
	);
	return versionId;
}

export async function markFormAsDefault(ctx: MutationCtx, formId: Id<"feedbackForms">) {
	const previousDefaultForm = await ctx.db
		.query("feedbackForms")
		.withIndex("by_isDefault", (index) => index.eq("isDefault", true))
		.unique();
	if (previousDefaultForm) await ctx.db.patch(previousDefaultForm._id, { isDefault: false });
	await ctx.db.patch(formId, { isDefault: true });
}
