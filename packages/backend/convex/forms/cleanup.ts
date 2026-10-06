import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

export const deleteLegacyResponses = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	handler: async (ctx, { cursor }): Promise<void> => {
		const responses = await ctx.db
			.query("formResponses")
			.paginate({ cursor: cursor ?? null, numItems: 100 });
		for (const response of responses.page) {
			if ("formId" in response) await ctx.db.delete(response._id);
		}
		if (!responses.isDone) {
			await ctx.scheduler.runAfter(0, internal.forms.cleanup.deleteLegacyResponses, {
				cursor: responses.continueCursor,
			});
		}
	},
});
