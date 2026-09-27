import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const accountStages = v.union(
	v.literal("onboarding"),
	v.literal("active"),
	v.literal("offboarding"),
	v.literal("offboarded"),
	v.literal("cancelled"),
);

export function isCurrentStage(stage: Infer<typeof accountStages>) {
	return stage === "onboarding" || stage === "active" || stage === "offboarding";
}

export const googleStates = v.union(
	v.literal("pending"),
	v.literal("created"),
	v.literal("existing"),
	v.literal("suspended"),
	v.literal("not_applicable"),
);

export const driftKinds = v.union(
	v.literal("google_without_member"),
	v.literal("member_google_suspended"),
	v.literal("slack_without_member"),
);

export const iamSchema = {
	memberAccounts: defineTable({
		workspaceEmail: v.string(),
		uioEmail: v.optional(v.string()),
		firstName: v.string(),
		lastName: v.string(),
		group: v.string(),
		stage: accountStages,
		google: googleStates,
		googleUserId: v.optional(v.string()),
		googleOwner: v.optional(v.string()),
		googleConfirmed: v.optional(v.boolean()),
		googleReactivated: v.optional(v.boolean()),
		welcomeSentAt: v.optional(v.number()),
		slackUserId: v.optional(v.string()),
		slackDeactivatedAt: v.optional(v.number()),
		userId: v.optional(v.id("users")),
		invitedBy: v.optional(v.id("users")),
		lastError: v.optional(v.string()),
		updatedAt: v.number(),
	})
		.index("by_workspaceEmail", ["workspaceEmail"])
		.index("by_uioEmail", ["uioEmail"])
		.index("by_userId", ["userId"])
		.index("by_stage", ["stage"]),
	accessDrift: defineTable({
		kind: driftKinds,
		email: v.string(),
		name: v.optional(v.string()),
		detectedAt: v.number(),
	}).index("by_email", ["email"]),
	accessDriftIgnores: defineTable({
		email: v.string(),
		ignoredBy: v.id("users"),
	}).index("by_email", ["email"]),
};
