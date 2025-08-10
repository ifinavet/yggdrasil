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

    const student = await ctx.db.get(id);
    if (!student) {
      throw new Error(`Student with ID ${id} not found.`);
    }

    await ctx.scheduler.runAfter(0, internal.points.givePointsEmail, {
      userId: student.userId,
      severity,
      reason,
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

    const points = await ctx.db
      .query("points")
      .withIndex("by_studentId", (q) => q.eq("studentId", id))
      .collect();

    if (points.reduce((acc, point) => acc + point.severity, 0) >= 3) {
      await ctx.runMutation(internal.points.tooManyPointsEmail, {
        studentsId: id,
      });
    }
  }
});

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
})

export const remove = mutation({
  args: {
    id: v.id("points"),
  },
  handler: async (ctx, { id }) => {
    await getCurrentUserOrThrow(ctx);

    await ctx.db.delete(id);
  }
})

export const checkIfAnyPointsShouldBeRemoved = internalMutation({
  handler: async (ctx) => {
    const points = await ctx.db.query("points")
      .withIndex("by_creation_time", q => q.lt("_creationTime", Date.now() - 6 * 30 * 24 * 60 * 60 * 1000))
      .collect();

    if (points.length === 0) {
      return;
    }

    await Promise.all(points.map(async (point) => {
      await ctx.db.delete(point._id);
    }));
  },
});
