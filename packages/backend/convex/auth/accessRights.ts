import { v } from "convex/values";
import { api } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import { getCurrentUser } from "./currentUser";

/**
 * Defines the allowed access right roles.
 */
export const accessRoles = v.union(
	v.literal("super-admin"),
	v.literal("admin"),
	v.literal("editor"),
	v.literal("internal"),
);

/**
 * Checks whether the current user has one of the requested roles.
 *
 * @param {("super-admin" | "admin" | "editor" | "internal")[]} right - The allowed roles to check against.
 *
 * @returns {boolean} - Whether the current user has one of the requested roles.
 */
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

/**
 * Creates or updates a user's access rights.
 *
 * @param {Id<"users">} userId - The id of the user whose rights should be updated.
 * @param {"super-admin" | "admin" | "editor" | "internal"} role - The role to assign.
 *
 * @throws - An error if the caller is unauthorized to change access rights.
 * @returns {null} - Returns null when the access rights are upserted successfully.
 */
export const upsertAccessRights = mutation({
	args: {
		userId: v.id("users"),
		role: accessRoles,
	},
	handler: async (ctx, { userId, role }) => {
		const currentUser = await getCurrentUser(ctx);
		if (!currentUser) throw new Error("Unauthorized");

		const isSuperAdmin = await ctx.runQuery(api.auth.accessRights.checkRights, {
			right: ["super-admin"],
		});
		if (!isSuperAdmin)
			throw new Error(
				"Unauthorized: You do not have permission to change access rights",
			);

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
});
