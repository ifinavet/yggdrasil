import { GUIDE_STEPS } from "@workspace/shared/guides";
import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { type MutationCtx, mutation } from "../../_generated/server";
import { getCurrentUserOrThrow } from "../clerk/queries";
import { seenStepsDoc } from "./queries";
import { guideKey } from "./schema";

export const markSeen = mutation({
	args: { guide: guideKey, step: v.string() },
	handler: async (ctx, { guide, step }) => {
		const steps: readonly string[] = GUIDE_STEPS[guide];
		if (!steps.includes(step)) throw new ConvexError("Ukjent steg i veiledningen.");
		const user = await getCurrentUserOrThrow(ctx);
		const doc = await seenStepsDoc(ctx, user._id, guide);
		if (!doc) {
			await ctx.db.insert("seenGuideSteps", { userId: user._id, guide, steps: [step] });
			return;
		}
		if (!doc.steps.includes(step)) await ctx.db.patch(doc._id, { steps: [...doc.steps, step] });
	},
});

export const reset = mutation({
	args: { guide: guideKey },
	handler: async (ctx, { guide }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const doc = await seenStepsDoc(ctx, user._id, guide);
		if (doc) await ctx.db.delete(doc._id);
	},
});

export async function removeSeenGuideSteps(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const docs = await ctx.db
		.query("seenGuideSteps")
		.withIndex("by_userId_and_guide", (q) => q.eq("userId", userId))
		.collect();
	await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
}
