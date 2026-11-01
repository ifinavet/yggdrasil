import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { linkedUserId, superAdminRoles, userHasRole } from "../auth/accessRights";
import { getCurrentUser, getCurrentUserOrThrow } from "../auth/currentUser";

const BOARD_GROUP = "Styret";

async function semesterPlanRightsOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
	if (await userHasRole(ctx, userId, superAdminRoles))
		return { canPlan: true, canManageAccess: true };
	const memberId = (await linkedUserId(ctx, userId)) ?? userId;
	const internal = await ctx.db
		.query("internals")
		.withIndex("by_userId", (q) => q.eq("userId", memberId))
		.first();
	const onBoard = internal?.group === BOARD_GROUP;
	return { canPlan: onBoard || internal?.semesterPlanAccess === true, canManageAccess: onBoard };
}

export async function requireSemesterPlanner(
	ctx: QueryCtx | MutationCtx,
	right: "canPlan" | "canManageAccess" = "canPlan",
) {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await semesterPlanRightsOf(ctx, user._id))[right]) {
		throw new ConvexError("Unauthorized: Du har ikke tilgang til dette i semesterplanen.");
	}
	return user;
}

export async function refuseBoardGroupUnlessSuperAdmin(
	ctx: MutationCtx,
	callerId: Id<"users">,
	groups: (string | undefined)[],
) {
	if (groups.includes(BOARD_GROUP) && !(await userHasRole(ctx, callerId, superAdminRoles))) {
		throw new ConvexError(
			"Unauthorized: Bare super-admin kan legge til eller fjerne noen i Styret.",
		);
	}
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

export const setPlanners = mutation({
	args: { internalIds: v.array(v.id("internals")) },
	returns: v.null(),
	handler: async (ctx, { internalIds }) => {
		await requireSemesterPlanner(ctx, "canManageAccess");
		for (const internal of await ctx.db.query("internals").take(1000)) {
			const granted = internalIds.includes(internal._id);
			if ((internal.semesterPlanAccess === true) !== granted) {
				await ctx.db.patch(internal._id, { semesterPlanAccess: granted || undefined });
			}
		}
		return null;
	},
});
