import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, mutation } from "../../_generated/server";
import { getCurrentUserOrThrow } from "../clerk/queries";

/**
 * Creates a student record for an external user id.
 *
 * @param {string} externalId - The external auth provider id.
 * @param {"Årsstudium" | "Bachelor" | "Master" | "PhD"} degree - The student's degree.
 * @param {number} year - The student's study year.
 * @param {string} studyProgram - The student's study program.
 * @param {string} name - The student's display name.
 *
 * @returns {null} - Returns null when the student is created successfully.
 */
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

/**
 * Updates the current student's study information.
 *
 * @param {number} year - The updated study year.
 * @param {string} studyProgram - The updated study program.
 * @param {"Årsstudium" | "Bachelor" | "Master" | "PhD"} degree - The updated degree.
 *
 * @throws - An error if the current user has no linked student record.
 * @returns {null} - Returns null when the student is updated successfully.
 */
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

/**
 * Updates a student record by id.
 *
 * @param {Id<"students">} id - The id of the student to update.
 * @param {number} year - The updated study year.
 * @param {string} studyProgram - The updated study program.
 * @param {"Årsstudium" | "Bachelor" | "Master" | "PhD"} degree - The updated degree.
 *
 * @throws - An error if the caller is unauthenticated.
 * @returns {null} - Returns null when the student is updated successfully.
 */
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

/**
 * Increments the year for all students, capped at five.
 *
 * @returns {null} - Returns null when all student years have been updated.
 */
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
