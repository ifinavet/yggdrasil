import { MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

/**
 * Fetches the current user and throws if no matching user exists.
 *
 * @param {AuthCtx} ctx - The Convex query or mutation context.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {Promise<Doc<"users">>} - The current user document.
 */
export async function getCurrentUserOrThrow(ctx: AuthCtx) {
    const userRecord = await getCurrentUser(ctx);
    if (!userRecord) throw new Error("Can't get current user");
    return userRecord;
}

/**
 * Fetches the current user if the request is authenticated.
 *
 * @param {AuthCtx} ctx - The Convex query or mutation context.
 *
 * @returns {Promise<Doc<"users"> | null>} - The current user document, or null when unauthenticated.
 */
export async function getCurrentUser(ctx: AuthCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
        return null;
    }
    return await userByExternalId(ctx, identity.subject);
}

/**
 * Fetches a user by external auth provider id.
 *
 * @param {AuthCtx} ctx - The Convex query or mutation context.
 * @param {string} externalId - The external auth provider id.
 *
 * @returns {Promise<Doc<"users"> | null>} - The matching user document, if one exists.
 */
export async function userByExternalId(ctx: AuthCtx, externalId: string) {
    return await ctx.db
        .query("users")
        .withIndex("by_ExternalId", (q) => q.eq("externalId", externalId))
        .unique();
}
