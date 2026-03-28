import { v } from "convex/values";
import { query } from "../../_generated/server";


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