import { GUIDE_KEYS } from "@workspace/shared/guides";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const guideKey = v.union(...GUIDE_KEYS.map((guide) => v.literal(guide)));

export const guidesSchema = {
	seenGuideSteps: defineTable({
		userId: v.id("users"),
		guide: guideKey,
		steps: v.array(v.string()),
	}).index("by_userId_and_guide", ["userId", "guide"]),
};
