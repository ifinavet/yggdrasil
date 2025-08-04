import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

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

export const givePoints = mutation({
  args: {
    id: v.id("students"),
    reason: v.string(),
    severity: v.number(),
  },
  handler: async (ctx, { id, reason, severity }) => {
    await ctx.runMutation(internal.points.givePointsInternal, {
      id,
      reason,
      severity,
    });
  },
});

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
  },
});

export const remove = mutation({
  args: {
    id: v.id("points"),
  },
  handler: async (ctx, { id }) => {
    await getCurrentUserOrThrow(ctx);

    await ctx.db.delete(id);
  }
})
