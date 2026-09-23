import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

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
