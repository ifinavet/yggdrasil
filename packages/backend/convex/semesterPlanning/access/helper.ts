import { BOARD_GROUP } from "@workspace/shared/organization";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalRoles, superAdminRoles, userHasRole } from "../../auth/accessRights";
import { getCurrentUser, getCurrentUserOrThrow } from "../../auth/currentUser";
import { accountForEmail } from "../../iam/accounts";

type Ctx = QueryCtx | MutationCtx;

/** What a user may do in Semesterplan beyond reading the plan. */
export type SemesterPlanRights = {
	/** Sees every tab and may change, delete and send anything in the semester plan. */
	canPlan: boolean;
	/** May give and take away planning access for other internal members. */
	canManageAccess: boolean;
};

const NO_RIGHTS: SemesterPlanRights = { canPlan: false, canManageAccess: false };

/**
 * The user and the active member account they are linked to, like `getAccessRole`, so a personal
 * login and a position login count as the same person.
 */
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

/**
 * Whether one of the user ids has been given planning access by the board.
 *
 * @param {Ctx} ctx - The Convex query or mutation context.
 * @param {Id<"users">[]} userIds - The user and their linked account.
 *
 * @returns {Promise<boolean>} - Whether a grant exists.
 */
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

/**
 * What a user may do in Semesterplan. A super-admin may do everything. Otherwise the user must be
 * an active internal: a member of the board may plan and manage access, and a member the board has
 * given access may plan.
 *
 * @param {Ctx} ctx - The Convex query or mutation context.
 * @param {Id<"users">} userId - The user to check.
 *
 * @returns {Promise<SemesterPlanRights>} - The user's planning rights.
 */
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

/**
 * The current user's planning rights; none when nobody is signed in.
 *
 * @param {Ctx} ctx - The Convex query or mutation context.
 *
 * @returns {Promise<SemesterPlanRights>} - The caller's planning rights.
 */
export async function currentSemesterPlanRights(ctx: Ctx): Promise<SemesterPlanRights> {
	const user = await getCurrentUser(ctx);
	return user ? await semesterPlanRightsOf(ctx, user._id) : NO_RIGHTS;
}

/**
 * Requires the caller to plan the semester: the board, a member given access, or a super-admin.
 *
 * @param {Ctx} ctx - The Convex query or mutation context.
 *
 * @throws - An error if the caller may not plan the semester.
 * @returns {Promise<Doc<"users">>} - The caller.
 */
export async function requireSemesterPlanner(ctx: Ctx): Promise<Doc<"users">> {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await semesterPlanRightsOf(ctx, user._id)).canPlan) {
		throw new ConvexError(
			"Unauthorized: Bare styret og de styret har gitt tilgang kan endre semesterplanen.",
		);
	}
	return user;
}

/**
 * Requires the caller to manage planning access: the board or a super-admin.
 *
 * @param {Ctx} ctx - The Convex query or mutation context.
 *
 * @throws - An error if the caller may not manage planning access.
 * @returns {Promise<Doc<"users">>} - The caller.
 */
export async function requireSemesterPlanAccessManager(ctx: Ctx): Promise<Doc<"users">> {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await semesterPlanRightsOf(ctx, user._id)).canManageAccess) {
		throw new ConvexError("Unauthorized: Bare styret kan gi og fjerne tilgang til semesterplanen.");
	}
	return user;
}
