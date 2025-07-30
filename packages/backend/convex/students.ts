import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAllPaged = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const students = await ctx.db.query("students").paginate(paginationOpts);

    const studentsWithLockedStatus = await Promise.all(
      students.page.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        return {
          ...student,
          status: user ? (user.locked ? "Låst" : "Aktiv") : "Ikke registrert",
        };
      }),
    );

    return {
      ...students,
      page: studentsWithLockedStatus,
    };
  },
});

export const getById = query({
  args: { id: v.id("students") },
  handler: async (ctx, { id }) => {
    const student = await ctx.db.get(id);
    if (!student) {
      throw new Error("Student not found");
    }
    const user = await ctx.db.get(student.userId);
    if (!user) {
      throw new Error("User not found for the student");
    }

    return {
      id: student._id,
      userId: student.userId,
      email: student.email,
      firstName: user.firstName,
      lastName: user.lastName,
      studyProgram: student.studyProgram,
      semester: student.semester,
      degree: student.degree,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("students"),
    semester: v.number(),
    studyProgram: v.string(),
    degree: v.union(v.literal("bachelor"), v.literal("master"), v.literal("phd")),
  },
  handler: async (ctx, { id, semester, studyProgram, degree }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthenticated call to mutation");
    }

    await ctx.db.patch(id, {
      semester,
      studyProgram,
      degree,
    });
  },
});
