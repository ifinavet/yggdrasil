import { v } from "convex/values";
import { api } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { accessRoles } from "../../auth/accessRights";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

export const upsertBoardMember = mutation({
    args: {
        id: v.id("internals"),
        userId: v.id("users"),
        position: v.string(),
        group: v.string(),
        positionEmail: v.optional(v.string()),
        role: accessRoles,
    },
    handler: async (
        ctx,
        { id, userId, position, group, positionEmail, role },
    ) => {
        const currentBoardMember = await ctx.db.get(id);
        if (!currentBoardMember)
            throw new Error(`Board member not found for ID: ${id}`);

        await ctx.runMutation(api.accsessRights.upsertAccessRights, {
            userId,
            role,
        });

        if (currentBoardMember.userId !== userId) {
            await ctx.db.patch(id, {
                group: "",
                positionEmail: "",
                position: "Intern",
                rank: undefined,
            });

            const newBoardMember = await ctx.db
                .query("internals")
                .withIndex("by_userId", (q) => q.eq("userId", userId))
                .first();
            if (!newBoardMember)
                throw new Error(`New board member not found for user ID: ${userId}`);

            await ctx.db.patch(newBoardMember._id, {
                group,
                positionEmail,
                position,
                rank: currentBoardMember.rank,
            });
        } else {
            await ctx.db.patch(id, {
                position,
                group,
                positionEmail,
            });
        }
    },
});


export const createInternal = mutation({
    args: {
        userId: v.id("users"),
        group: v.string(),
    },
    handler: async (ctx, { userId, group }) => {
        await getCurrentUserOrThrow(ctx);

        const existingInternal = await ctx.db
            .query("internals")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (existingInternal) {
            throw new Error(`Internal member already exists for user ID: ${userId}`);
        }

        await ctx.db.insert("internals", {
            userId,
            group,
            position: "Intern",
        });

        await ctx.runMutation(api.accsessRights.upsertAccessRights, {
            userId,
            role: "internal",
        });
    },
});

export const removeInternal = mutation({
    args: {
        id: v.id("internals"),
    },
    handler: async (ctx, { id }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.delete(id);
    },
});

export const updateInternal = mutation({
    args: {
        id: v.id("internals"),
        group: v.string(),
    },
    handler: async (ctx, { id, group }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.patch(id, { group });
    },
});