import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, mutation } from "../../_generated/server";
import { getCurrentUserOrThrow } from "../clerk/queries";

export const createByExternalId = mutation({
    args: {
        externalId: v.string(),
        degree: v.union(
            v.literal("Årsstudium"),
            v.literal("Bachelor"),
            v.literal("Master"),
            v.literal("PhD"),
        ),
        year: v.number(),
        studyProgram: v.string(),
        name: v.string(),
    },
    handler: async (ctx, { externalId, degree, year, studyProgram, name }) => {
        const identity = await ctx.auth.getUserIdentity();
        console.log("Identity from auth:", identity);

        const userId = await ctx.runMutation(internal.users.clerk.mutations.createIfNotExists, {
            externalId,
            firstName: identity?.givenName ?? "Pending...",
            lastName: identity?.familyName ?? "Pending...",
            email: identity?.email ?? "Pending...",
            image: identity?.profileUrl ?? "Pending...",
        });

        await ctx.db.insert("students", {
            userId,
            degree,
            year,
            studyProgram: studyProgram.trim(),
            name: name.trim(),
        });
    },
});

export const updateCurrent = mutation({
    args: {
        year: v.number(),
        studyProgram: v.string(),
        degree: v.union(
            v.literal("Årsstudium"),
            v.literal("Bachelor"),
            v.literal("Master"),
            v.literal("PhD"),
        ),
    },
    handler: async (ctx, { year, studyProgram, degree }) => {
        const user = await getCurrentUserOrThrow(ctx);

        const student = await ctx.db
            .query("students")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        if (!student) {
            throw new Error("Student not found for the user");
        }

        await ctx.db.patch(student._id, {
            year,
            studyProgram,
            degree,
        });
    },
});

export const update = mutation({
    args: {
        id: v.id("students"),
        year: v.number(),
        studyProgram: v.string(),
        degree: v.union(
            v.literal("Årsstudium"),
            v.literal("Bachelor"),
            v.literal("Master"),
            v.literal("PhD"),
        ),
    },
    handler: async (ctx, { id, year, studyProgram, degree }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        await ctx.db.patch(id, {
            year,
            studyProgram,
            degree,
        });
    },
});

export const updateYear = internalMutation({
    handler: async (ctx) => {
        const students = await ctx.db.query("students").collect();

        await Promise.all(
            students.map(async (student) => {
                return await ctx.db.patch(student._id, {
                    year: Math.min((student.year ?? 1) + 1, 5),
                });
            }),
        );
    },
});
