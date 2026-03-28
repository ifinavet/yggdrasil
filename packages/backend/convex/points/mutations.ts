import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation } from "../_generated/server";
import { getCurrentUserOrThrow } from "../auth/currentUser";

/**
 * Gives points to a student and schedules the notification email.
 *
 * @param {Id<"students">} id - The id of the student receiving points.
 * @param {string} reason - The reason for the points.
 * @param {number} severity - The number of points to assign.
 *
 * @throws - An error if the student cannot be found.
 * @returns {null} - Returns null when the points are created successfully.
 */
export const givePoints = mutation({
    args: {
        id: v.id("students"),
        reason: v.string(),
        severity: v.number(),
    },
    handler: async (ctx, { id, reason, severity }) => {
        await ctx.runMutation(internal.points.mutations.givePointsInternal, {
            id,
            reason,
            severity,
        });

        const student = await ctx.db.get(id);
        if (!student) {
            throw new Error(`Student with ID ${id} not found.`);
        }

        await ctx.scheduler.runAfter(0, internal.points.mutations.givePointsEmail, {
            userId: student.userId,
            severity,
            reason,
        });
    },
});

/**
 * Inserts a points record and triggers the locked-out notification threshold check.
 *
 * @param {Id<"students">} id - The id of the student receiving points.
 * @param {string} reason - The reason for the points.
 * @param {number} severity - The number of points to assign.
 *
 * @throws - An error if the caller is unauthenticated.
 * @returns {null} - Returns null when the points are stored successfully.
 */
export const givePointsInternal = internalMutation({
    args: {
        id: v.id("students"),
        reason: v.string(),
        severity: v.number(),
    },
    handler: async (ctx, { id, reason, severity }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        await ctx.db.insert("points", {
            studentId: id,
            reason,
            severity,
        });

        const points = await ctx.db
            .query("points")
            .withIndex("by_studentId", (q) => q.eq("studentId", id))
            .collect();

        if (points.reduce((acc, point) => acc + point.severity, 0) >= 3) {
            await ctx.runMutation(internal.points.mutations.tooManyPointsEmail, {
                studentsId: id,
            });
        }
    },
});

/**
 * Schedules the email notifying a user about newly assigned points.
 *
 * @param {Id<"users">} userId - The id of the user to notify.
 * @param {number} severity - The number of points assigned.
 * @param {string} reason - The reason for the points.
 *
 * @throws - An error if the user cannot be found.
 * @returns {null} - Returns null when the email job is scheduled successfully.
 */
export const givePointsEmail = internalMutation({
    args: {
        userId: v.id("users"),
        severity: v.number(),
        reason: v.string(),
    },
    handler: async (ctx, { userId, severity, reason }) => {
        const user = await ctx.db.get(userId);

        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }

        await ctx.scheduler.runAfter(0, internal.emails.sendGottenPointsEmail, {
            participantEmail: user.email,
            severity,
            reason,
        });
    },
});

/**
 * Schedules the email notifying a student that they have too many points.
 *
 * @param {Id<"students">} studentsId - The id of the student to notify.
 *
 * @throws - An error if the student or linked user cannot be found.
 * @returns {null} - Returns null when the email job is scheduled successfully.
 */
export const tooManyPointsEmail = internalMutation({
    args: {
        studentsId: v.id("students"),
    },
    handler: async (ctx, { studentsId }) => {
        const student = await ctx.db.get(studentsId);
        if (!student) {
            throw new Error(`Student with ID ${studentsId} not found.`);
        }

        const user = await ctx.db.get(student.userId);
        if (!user) {
            throw new Error(`User with ID ${student.userId} not found.`);
        }

        await ctx.scheduler.runAfter(0, internal.emails.sendTooManyPointsEmail, {
            participantEmail: user.email,
        });
    },
});

/**
 * Deletes a points record by id.
 *
 * @param {Id<"points">} id - The id of the points record to delete.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the points record is deleted successfully.
 */
export const remove = mutation({
    args: {
        id: v.id("points"),
    },
    handler: async (ctx, { id }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.delete(id);
    },
});

/**
 * Deletes points records older than roughly six months.
 *
 * @returns {null} - Returns null when the cleanup has completed.
 */
export const checkIfAnyPointsShouldBeRemoved = internalMutation({
    handler: async (ctx) => {
        const points = await ctx.db
            .query("points")
            .withIndex("by_creation_time", (q) =>
                q.lt("_creationTime", Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
            )
            .collect();

        if (points.length === 0) {
            return;
        }

        await Promise.all(
            points.map(async (point) => {
                await ctx.db.delete(point._id);
            }),
        );
    },
});
