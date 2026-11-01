import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import { internalRoles, userHasRole } from "../../auth/accessRights";
import { requireSemesterPlanAccessManager, semesterPlanRightsOf } from "./helper";

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

export const revoke = mutation({
	args: { grantId: v.id("semesterPlanAccess") },
	returns: v.null(),
	handler: async (ctx, { grantId }) => {
		await requireSemesterPlanAccessManager(ctx);
		if (await ctx.db.get(grantId)) await ctx.db.delete(grantId);
		return null;
	},
});
