import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function findUserResponse(ctx: QueryCtx, formId: Id<"form">, userId: string) {
	const indexed = await ctx.db
		.query("formResponses")
		.withIndex("by_formId_and_userId", (q) => q.eq("formId", formId).eq("userId", userId))
		.first();
	if (indexed) return indexed;
	// Until backfillResponseUserId finishes, search only responses missing the indexed identity.
	return await ctx.db
		.query("formResponses")
		.withIndex("by_formId_and_userId", (q) => q.eq("formId", formId).eq("userId", undefined))
		.filter((q) => q.eq(q.field("data.userId"), userId))
		.first();
}
