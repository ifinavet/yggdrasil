import { v } from "convex/values";
import { api } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { accessRoles } from "../../auth/accessRights";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

/**
 * Updates a board member assignment and synchronizes access rights.
 *
 * @param {Id<"internals">} id - The id of the current board member record.
 * @param {Id<"users">} userId - The user that should hold the board position.
 * @param {string} position - The board position title.
 * @param {string} group - The internal group name.
 * @param {string | undefined} positionEmail - The optional role email.
 * @param {"super-admin" | "admin" | "editor" | "internal"} role - The access role to assign.
 *
 * @throws - An error if the current or replacement board member record cannot be found.
 * @returns {null} - Returns null when the board member has been updated successfully.
 */
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

        await ctx.runMutation(api.auth.accessRights.upsertAccessRights, {
            userId,
            role,
        });

        if (currentBoardMember.userId === userId) {
            await ctx.db.patch(id, {
                position,
                group,
                positionEmail,

            });
        } else {
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
        }
    },
});


/**
 * Creates an internal member record and assigns the internal access role.
 *
 * @param {Id<"users">} userId - The user to create an internal record for.
 * @param {string} group - The internal group name.
 *
 * @throws - An error if the current user cannot be resolved or the internal record already exists.
 * @returns {null} - Returns null when the internal member is created successfully.
 */
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

        await ctx.runMutation(api.auth.accessRights.upsertAccessRights, {
            userId,
            role: "internal",
        });
    },
});

/**
 * Deletes an internal member record.
 *
 * @param {Id<"internals">} id - The id of the internal record to delete.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the internal record is deleted successfully.
 */
export const removeInternal = mutation({
    args: {
        id: v.id("internals"),
    },
    handler: async (ctx, { id }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.delete(id);
    },
});

/**
 * Updates the group on an internal member record.
 *
 * @param {Id<"internals">} id - The id of the internal record to update.
 * @param {string} group - The updated internal group name.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the internal record is updated successfully.
 */
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
