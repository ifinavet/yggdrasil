import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentUserOrThrow } from "../users/clerk/queries";

/**
 * Fetches all points records for a student.
 *
 * @param {Id<"students">} id - The id of the student to inspect.
 *
 * @returns {Doc<"points">[]} - The points records for the student.
 */
export const getByStudentId = query({
    args: { id: v.id("students") },
    handler: async (ctx, { id }) => {
        const points = await ctx.db
            .query("points")
            .withIndex("by_studentId", (q) => q.eq("studentId", id))
            .collect();
        return points;
    },
});

/**
 * Fetches all points records for the current student.
 *
 * @throws - An error if the current user has no linked student record.
 * @returns {Doc<"points">[]} - The current student's points records.
 */
export const getCurrentStudentsPoints = query({
    handler: async (ctx) => {
        const user = await getCurrentUserOrThrow(ctx);

        const student = await ctx.db
            .query("students")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        if (!student) {
            throw new Error("Student not found for the user");
        }

        const points = await ctx.db
            .query("points")
            .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
            .collect();

        return points;
    },
});
