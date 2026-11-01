import { BOARD_GROUP } from "@workspace/shared/organization";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalRoles, superAdminRoles, userHasRole } from "../../auth/accessRights";
import { getCurrentUser, getCurrentUserOrThrow } from "../../auth/currentUser";
import { accountForEmail } from "../../iam/accounts";

type Ctx = QueryCtx | MutationCtx;

export type SemesterPlanRights = {
	canPlan: boolean;
	canManageAccess: boolean;
};

const NO_RIGHTS: SemesterPlanRights = { canPlan: false, canManageAccess: false };

async function sameMember(ctx: Ctx, userId: Id<"users">): Promise<Id<"users">[]> {
	const user = await ctx.db.get(userId);
	if (!user?.email) return [userId];
	const account = await accountForEmail(ctx, user.email);
	if (account?.stage !== "active" || !account.userId || account.userId === userId) return [userId];
	return [userId, account.userId];
}

async function internalRowsOf(ctx: Ctx, userIds: Id<"users">[]): Promise<Doc<"internals">[]> {
	const rows = await Promise.all(
		userIds.map((userId) =>
			ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.first(),
		),
	);
	return rows.filter((row) => row !== null);
}

async function hasGrant(ctx: Ctx, userIds: Id<"users">[]): Promise<boolean> {
	const grants = await Promise.all(
		userIds.map((userId) =>
			ctx.db
				.query("semesterPlanAccess")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.first(),
		),
	);
	return grants.some((grant) => grant !== null);
}

export async function semesterPlanRightsOf(
	ctx: Ctx,
	userId: Id<"users">,
): Promise<SemesterPlanRights> {
	if (await userHasRole(ctx, userId, superAdminRoles)) {
		return { canPlan: true, canManageAccess: true };
	}
	if (!(await userHasRole(ctx, userId, internalRoles))) return NO_RIGHTS;

	const userIds = await sameMember(ctx, userId);
	const rows = await internalRowsOf(ctx, userIds);
	if (rows.length === 0) return NO_RIGHTS;

	if (rows.some((row) => row.group === BOARD_GROUP)) {
		return { canPlan: true, canManageAccess: true };
	}
	return { canPlan: await hasGrant(ctx, userIds), canManageAccess: false };
}

export async function currentSemesterPlanRights(ctx: Ctx): Promise<SemesterPlanRights> {
	const user = await getCurrentUser(ctx);
	return user ? await semesterPlanRightsOf(ctx, user._id) : NO_RIGHTS;
}

export async function requireSemesterPlanner(ctx: Ctx): Promise<Doc<"users">> {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await semesterPlanRightsOf(ctx, user._id)).canPlan) {
		throw new ConvexError(
			"Unauthorized: Bare styret og de styret har gitt tilgang kan endre semesterplanen.",
		);
	}
	return user;
}

export async function requireSemesterPlanAccessManager(ctx: Ctx): Promise<Doc<"users">> {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await semesterPlanRightsOf(ctx, user._id)).canManageAccess) {
		throw new ConvexError("Unauthorized: Bare styret kan gi og fjerne tilgang til semesterplanen.");
	}
	return user;
}
