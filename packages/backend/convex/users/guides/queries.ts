import type { GuideKey } from "@workspace/shared/guides";
import type { Id } from "../../_generated/dataModel";
import { type QueryCtx, query } from "../../_generated/server";
import { getCurrentUser } from "../clerk/queries";
import { guideKey } from "./schema";

export function seenStepsDoc(ctx: QueryCtx, userId: Id<"users">, guide: GuideKey) {
	return ctx.db
		.query("seenGuideSteps")
		.withIndex("by_userId_and_guide", (q) => q.eq("userId", userId).eq("guide", guide))
		.unique();
}

export const seen = query({
	args: { guide: guideKey },
	handler: async (ctx, { guide }) => {
		const user = await getCurrentUser(ctx);
		if (!user) return null;
		const doc = await seenStepsDoc(ctx, user._id, guide);
		return doc?.steps ?? [];
	},
});
