import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

export async function getFormOrThrow(ctx: QueryCtx, formId: Id<"feedbackForms">) {
	const form = await ctx.db.get(formId);
	if (!form) throw new ConvexError("Skjemaet finnes ikke.");
	return form;
}

export async function latestVersion(ctx: QueryCtx, formId: Id<"feedbackForms">) {
	return await ctx.db
		.query("formVersions")
		.withIndex("by_formDefinitionId_and_publishedAt", (q) => q.eq("formDefinitionId", formId))
		.order("desc")
		.first();
}
