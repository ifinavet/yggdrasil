import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { getCurrentUser, getCurrentUserOrThrow } from "./currentUser";

/**
 * Defines the allowed access right roles.
 */
export const accessRoles = v.union(
	v.literal("super-admin"),
	v.literal("admin"),
	v.literal("editor"),
	v.literal("internal"),
);

export type AccessRole = Infer<typeof accessRoles>;

export const superAdminRoles: readonly AccessRole[] = ["super-admin"];
export const adminRoles: readonly AccessRole[] = [...superAdminRoles, "admin"];
export const editorRoles: readonly AccessRole[] = [...adminRoles, "editor"];
export const internalRoles: readonly AccessRole[] = [...editorRoles, "internal"];

/**
 * Reads the access role assigned to a user.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"users">} userId - The id of the user to read the role for.
 *
 * @returns {Promise<AccessRole | null>} - The assigned role, or null when the user has none.
 */
export async function getAccessRole(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
): Promise<AccessRole | null> {
	const assignedRights = await ctx.db
		.query("accessRights")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();

	return assignedRights?.role ?? null;
}

/**
 * Checks whether a user holds one of the allowed roles.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"users">} userId - The id of the user to check.
 * @param {readonly AccessRole[]} allowedRoles - The roles that grant access.
 *
 * @returns {Promise<boolean>} - Whether the user holds one of the allowed roles.
 */
export async function userHasRole(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	allowedRoles: readonly AccessRole[],
): Promise<boolean> {
	const assignedRole = await getAccessRole(ctx, userId);
	return assignedRole !== null && allowedRoles.includes(assignedRole);
}

/**
 * Describes the allowed roles as a Norwegian list for error messages.
 *
 * @param {readonly AccessRole[]} allowedRoles - The roles that grant access.
 *
 * @returns {string} - The roles joined into a readable list.
 */
function describeAllowedRoles(allowedRoles: readonly AccessRole[]): string {
	const lastRole = allowedRoles.at(-1);
	if (!lastRole) return "";

	const earlierRoles = allowedRoles.slice(0, -1);
	if (earlierRoles.length === 0) return lastRole;

	return `${earlierRoles.join(", ")} eller ${lastRole}`;
}

/**
 * Resolves the current user and requires that they hold one of the allowed roles.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {readonly AccessRole[]} allowedRoles - The roles that grant access.
 *
 * @throws - An error if the current user cannot be resolved or lacks the allowed roles.
 * @returns {Promise<Doc<"users">>} - The current user document.
 */
export async function requireRole(
	ctx: QueryCtx | MutationCtx,
	allowedRoles: readonly AccessRole[],
): Promise<Doc<"users">> {
	const currentUser = await getCurrentUserOrThrow(ctx);

	if (!(await userHasRole(ctx, currentUser._id, allowedRoles))) {
		throw new ConvexError(
			`Unauthorized: Du har ikke tilgang til denne handlingen. Krever rollen: ${describeAllowedRoles(allowedRoles)}.`,
		);
	}

	return currentUser;
}

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

		return await userHasRole(ctx, currentUser._id, right);
	},
});

/**
 * Creates or updates the access role assigned to a user, without checking the caller.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"users">} userId - The id of the user whose role should be assigned.
 * @param {AccessRole} role - The role to assign.
 *
 * @returns {Promise<void>} - Resolves when the role has been assigned.
 */
export async function assignAccessRole(
	ctx: MutationCtx,
	userId: Id<"users">,
	role: AccessRole,
): Promise<void> {
	const usersRights = await ctx.db
		.query("accessRights")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();

	if (usersRights) {
		await ctx.db.patch(usersRights._id, { role });
	} else {
		await ctx.db.insert("accessRights", { userId, role });
	}
}

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
		await requireRole(ctx, superAdminRoles);

		await assignAccessRole(ctx, userId, role);
	},
});
