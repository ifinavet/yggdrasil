import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getCurrentUser } from "../../auth/currentUser";

export {
    getCurrentUser,
    getCurrentUserOrThrow,
    userByExternalId,
} from "../../auth/currentUser";

/**
 * Fetches the current authenticated user.
 *
 * @returns {Promise<Doc<"users"> | null>} - The current user document, or null when unauthenticated.
 */
export const current = query({
    args: {},
    handler: async (ctx) => {
        return await getCurrentUser(ctx);
    },
});

/**
 * Searches users by email with pagination.
 *
 * @param {string} searchInput - The email search string.
 * @param {PaginationOptions} paginationOpts - The Convex pagination options.
 *
 * @returns {PaginationResult<Doc<"users">>} - The paginated search result.
 */
export const searchAfterUsers = query({
    args: {
        searchInput: v.string(),
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { searchInput, paginationOpts }) => {
        const users = await ctx.db
            .query("users")
            .withSearchIndex("search_email", (q) => q.search("email", searchInput))
            .paginate(paginationOpts);

        return users;
    },
});
