import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { linkedUserId, superAdminRoles, userHasRole } from "../auth/accessRights";
import { getCurrentUser, getCurrentUserOrThrow } from "../auth/currentUser";

type Ctx = QueryCtx | MutationCtx;

const BOARD_GROUP = "Styret";

async function semesterPlanRightsOf(ctx: Ctx, userId: Id<"users">) {
	if (await userHasRole(ctx, userId, superAdminRoles))
		return { canPlan: true, canManageAccess: true };

	const linkedId = await linkedUserId(ctx, userId);
	const userIds = linkedId ? [userId, linkedId] : [userId];
	const internals = await Promise.all(
		userIds.map((id) =>
			ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", id))
				.first(),
		),
	);
	if (internals.some((internal) => internal?.group === BOARD_GROUP)) {
		return { canPlan: true, canManageAccess: true };
	}

	const grants = await Promise.all(
		internals.map((internal) =>
			internal
				? ctx.db
						.query("semesterPlanAccess")
						.withIndex("by_userId", (q) => q.eq("userId", internal.userId))
						.first()
				: null,
		),
	);
	return { canPlan: grants.some((grant) => grant !== null), canManageAccess: false };
}

async function requireRights(ctx: Ctx, right: "canPlan" | "canManageAccess") {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await semesterPlanRightsOf(ctx, user._id))[right]) {
		throw new ConvexError("Unauthorized: Du har ikke tilgang til dette i semesterplanen.");
	}
	return user;
}

export async function requireSemesterPlanner(ctx: Ctx) {
	return await requireRights(ctx, "canPlan");
}

export const myRights = query({
	args: {},
	returns: v.object({ canPlan: v.boolean(), canManageAccess: v.boolean() }),
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		if (!user) return { canPlan: false, canManageAccess: false };
		return await semesterPlanRightsOf(ctx, user._id);
	},
});

export const listGrants = query({
	args: {},
	handler: async (ctx) => {
		await requireRights(ctx, "canPlan");
		return await ctx.db.query("semesterPlanAccess").take(200);
	},
});

export const grant = mutation({
	args: { userId: v.id("users") },
	handler: async (ctx, { userId }) => {
		const caller = await requireRights(ctx, "canManageAccess");
		const internal = await ctx.db
			.query("internals")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
		if (!internal) throw new ConvexError("Bare interne kan få tilgang til semesterplanen.");
		if ((await semesterPlanRightsOf(ctx, userId)).canPlan) {
			throw new ConvexError("Personen har allerede tilgang til semesterplanen.");
		}
		return await ctx.db.insert("semesterPlanAccess", { userId, grantedBy: caller._id });
	},
});

export const revoke = mutation({
	args: { grantId: v.id("semesterPlanAccess") },
	handler: async (ctx, { grantId }) => {
		await requireRights(ctx, "canManageAccess");
		if (await ctx.db.get(grantId)) await ctx.db.delete(grantId);
	},
});

export async function removeSemesterPlanAccess(ctx: MutationCtx, userId: Id<"users">) {
	const grants = await ctx.db
		.query("semesterPlanAccess")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.take(10);
	for (const grant of grants) await ctx.db.delete(grant._id);
}
