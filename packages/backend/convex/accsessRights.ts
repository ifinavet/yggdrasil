import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

const accessRoles = v.union(
	v.literal("super-admin"),
	v.literal("admin"),
	v.literal("editor"),
	v.literal("internal"),
);

export const checkRights = query({
	args: {
		right: v.array(accessRoles),
	},
	handler: async (ctx, { right }) => {
		const currentUser = await getCurrentUser(ctx);
		if (!currentUser) return false;

		const usersRights = await ctx.db
			.query("accessRights")
			.withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
			.first();
		if (!usersRights) return false;

		return right.includes(usersRights.role);
	},
});

export const upsertAccessRights = mutation({
	args: {
		userId: v.id("users"),
		role: accessRoles,
	},
	handler: async (ctx, { userId, role }) => {
		const currentUser = await getCurrentUser(ctx);
		if (!currentUser) throw new Error("Unauthorized");

		const isSuperAdmin = await ctx.runQuery(api.accsessRights.checkRights, { right: ["super-admin"] });
		if (!isSuperAdmin) throw new Error("Unauthorized: You do not have permission to change access rights");

		const usersRights = await ctx.db
			.query("accessRights")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();

		if (usersRights) {
			await ctx.db.patch(usersRights._id, { role });
		} else {
			await ctx.db.insert("accessRights", { userId, role });
		}
	},
});;
