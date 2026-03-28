import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getCurrentUser } from "../../auth/currentUser";

export {
    getCurrentUser,
    getCurrentUserOrThrow,
    userByExternalId,
} from "../../auth/currentUser";

export const current = query({
    args: {},
    handler: async (ctx) => {
        return await getCurrentUser(ctx);
    },
});

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
