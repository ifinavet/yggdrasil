import { v } from "convex/values";
import { query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
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
		await requireRole(ctx, adminRoles);

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
 * @returns {Doc<"points">[] | null} - The points records, or null when the user has no student profile.
 */
export const getCurrentStudentsPoints = query({
	handler: async (ctx) => {
		const user = await getCurrentUserOrThrow(ctx);

		const student = await ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.first();

		if (!student) return null;

		const points = await ctx.db
			.query("points")
			.withIndex("by_studentId", (q) => q.eq("studentId", student._id))
			.collect();

		return points;
	},
});
