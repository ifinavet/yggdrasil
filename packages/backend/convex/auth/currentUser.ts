import { MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

export async function getCurrentUserOrThrow(ctx: AuthCtx) {
    const userRecord = await getCurrentUser(ctx);
    if (!userRecord) throw new Error("Can't get current user");
    return userRecord;
}

export async function getCurrentUser(ctx: AuthCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
        return null;
    }
    return await userByExternalId(ctx, identity.subject);
}

export async function userByExternalId(ctx: AuthCtx, externalId: string) {
    return await ctx.db
        .query("users")
        .withIndex("by_ExternalId", (q) => q.eq("externalId", externalId))
        .unique();
}
