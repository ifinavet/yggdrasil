import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import { internalRoles, userHasRole } from "../../auth/accessRights";
import { requireSemesterPlanAccessManager, semesterPlanRightsOf } from "./helper";

/**
 * Lets an active internal member outside the board plan the semester. Only the board may do this.
 *
 * @param {Id<"users">} userId - The member to give access.
 *
 * @throws - An error if the caller is not on the board, the member is not an active internal, or
 * the member may already plan the semester.
 * @returns {Promise<Id<"semesterPlanAccess">>} - The id of the new grant.
 */
export const grant = mutation({
	args: { userId: v.id("users") },
	returns: v.id("semesterPlanAccess"),
	handler: async (ctx, { userId }) => {
		const caller = await requireSemesterPlanAccessManager(ctx);

		const internal = await ctx.db
			.query("internals")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
		if (!internal || !(await userHasRole(ctx, userId, internalRoles))) {
			throw new ConvexError("Bare aktive interne kan få tilgang til semesterplanen.");
		}
		if ((await semesterPlanRightsOf(ctx, userId)).canPlan) {
			throw new ConvexError("Personen har allerede tilgang til semesterplanen.");
		}

		return await ctx.db.insert("semesterPlanAccess", { userId, grantedBy: caller._id });
	},
});

/**
 * Takes planning access away from a member the board gave it to. Only the board may do this.
 *
 * @param {Id<"semesterPlanAccess">} grantId - The grant to remove.
 *
 * @throws - An error if the caller is not on the board.
 * @returns {Promise<null>} - Resolves when the grant is gone; removing a missing one is a no-op.
 */
export const revoke = mutation({
	args: { grantId: v.id("semesterPlanAccess") },
	returns: v.null(),
	handler: async (ctx, { grantId }) => {
		await requireSemesterPlanAccessManager(ctx);
		if (await ctx.db.get(grantId)) await ctx.db.delete(grantId);
		return null;
	},
});
