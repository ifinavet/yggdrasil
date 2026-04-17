import { v } from "convex/values";
import { query } from "../../_generated/server";

/**
 * Fetches a board member by position with linked user data.
 *
 * @param {string} position - The board position to look up.
 *
 * @throws - An error if the linked user cannot be found.
 * @returns {(Doc<"internals"> & Doc<"users">) | null} - The board member and user data, or null when not found.
 */
export const getBoardMemberByPosition = query({
    args: {
        position: v.string(),
    },
    handler: async (ctx, { position }) => {
        const member = await ctx.db
            .query("internals")
            .withIndex("by_position", (q) => q.eq("position", position))
            .first();

        if (!member) {
            return null;
        }

        const user = await ctx.db.get(member.userId);
        if (!user) {
            throw new Error(`User not found for board member with ID: ${member._id}`);
        }

        return {
            ...member,
            ...user,
        };
    },
});

/**
 * Fetches all board members ordered by rank.
 *
 * @returns {Array<Doc<"internals"> & { fullName: string, email: string, image: string | undefined }>} - The board member list.
 */
export const getTheBoard = query({
    handler: async (ctx) => {
        const members = await ctx.db
            .query("internals")
            .filter((q) => q.neq(q.field("position"), "Intern"))
            .collect();

        const boardMembers = await Promise.all(
            members.map(async (member) => {
                const user = await ctx.db.get(member.userId);
                return {
                    ...member,
                    fullName:
                        (user && `${user.firstName} ${user.lastName}`) ?? "Styremedlem",
                    email: user?.email ?? "styret@ifinavet.no",
                    image: user?.image,
                };
            }),
        );

        // Sort board members by rank, if defined
        boardMembers.sort((a, b) => {
            if (a.rank !== undefined && b.rank !== undefined) {
                return a.rank - b.rank;
            }

            if (a.rank !== undefined && b.rank === undefined) {
                return -1;
            }

            if (a.rank === undefined && b.rank !== undefined) {
                return 1;
            }

            return 0;
        });

        return boardMembers;
    },
});

/**
 * Fetches an internal member by id with user and access-right details.
 *
 * @param {Id<"internals">} id - The id of the internal record to fetch.
 *
 * @throws - An error if the internal record or linked user cannot be found.
 * @returns {Doc<"internals"> & { fullName: string, email: string, image: string, accessRights: string | undefined }} - The resolved internal member payload.
 */
export const getById = query({
    args: {
        id: v.id("internals"),
    },
    handler: async (ctx, { id }) => {
        const internal = await ctx.db.get(id);
        if (!internal) {
            throw new Error(`Internal record not found for ID: ${id}`);
        }

        const user = await ctx.db.get(internal.userId);
        if (!user) {
            throw new Error(`User not found for internal record with ID: ${id}`);
        }

        const rights = await ctx.db
            .query("accessRights")
            .withIndex("by_userId", (q) => q.eq("userId", internal.userId))
            .first();

        return {
            ...internal,
            fullName: `${user.firstName} ${user.lastName}`,
            email: user.email,
            image: user.image,
            accessRights: rights?.role,
        };
    },
});

/**
 * Fetches all internal members with resolved names.
 *
 * @returns {Array<Doc<"internals"> & { fullName: string }>} - All internal member records with display names.
 */
export const getAll = query({
    handler: async (ctx) => {
        const internals = await ctx.db.query("internals").collect();

        return await Promise.all(
            internals.map(async (internal) => {
                const user = await ctx.db.get(internal.userId);
                if (!user)
                    return {
                        ...internal,
                        fullName: "Ukjent, Error",
                    };

                return {
                    ...internal,
                    fullName: `${user.firstName} ${user.lastName}`,
                };
            }),
        );
    },
});

/**
 * Fetches all internal members that currently have the `Intern` position.
 *
 * @returns {Array<Doc<"internals"> & { fullName: string, email: string, image: string | null | undefined, role: string | undefined }>} - The internal members with user and role data.
 */
export const getAllInternals = query({
    handler: async (ctx) => {
        const internals = await ctx.db
            .query("internals")
            .withIndex("by_position", (q) => q.eq("position", "Intern"))
            .collect();

        return await Promise.all(
            internals.map(async (internal) => {
                const user = await ctx.db.get(internal.userId);

                const rights = await ctx.db
                    .query("accessRights")
                    .withIndex("by_userId", (q) => q.eq("userId", internal.userId))
                    .first();

                if (!user)
                    return {
                        ...internal,
                        fullName: "Ukjent, Error",
                        email: "Ukjent, Error",
                        image: null,
                        role: rights?.role,
                    };

                return {
                    ...internal,
                    fullName: `${user.firstName} ${user.lastName}`,
                    email: user.email,
                    image: user.image,
                    role: rights?.role,
                };
            }),
        );
    },
});
