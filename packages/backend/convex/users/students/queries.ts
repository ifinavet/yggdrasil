import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import { getCurrentUserOrThrow } from "../clerk/queries";

/**
 * Fetches paginated students, optionally filtered by search.
 *
 * @param {string | undefined} search - The optional student name search string.
 * @param {PaginationOptions} paginationOpts - The Convex pagination options.
 *
 * @returns {PaginationResult<Doc<"students"> & { status: string }>} - The paginated students result with account status.
 */
export const getAllPaged = query({
    args: {
        search: v.optional(v.string()),
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { search, paginationOpts }) => {
        const students = await (search && search.length > 0
            ? ctx.db
                .query("students")
                .withSearchIndex("search_name", (q) => q.search("name", search))
                .paginate(paginationOpts)
            : ctx.db.query("students").paginate(paginationOpts));

        const studentsWithLockedStatus = await Promise.all(
            students.page.map(async (student) => {
                const user = await ctx.db.get(student.userId);
                const userLocked = user?.locked ? "Låst" : "Aktiv";

                return {
                    ...student,
                    status: user ? userLocked : "Ikke registrert",
                };
            }),
        );

        return {
            ...students,
            page: studentsWithLockedStatus,
        };
    },
});

/**
 * Fetches all students with their total points count.
 *
 * @throws - An error if a referenced student cannot be found.
 * @returns {{ id: Id<"students">, name: string, points: number }[]} - Students sorted by total points.
 */
export const getAllWithPoints = query({
    handler: async (ctx) => {
        const points = await ctx.db.query("points").collect();
        const students = new Map<Id<"students">, Doc<"points">[]>();

        for (const point of points) {
            if (!students.has(point.studentId)) {
                students.set(point.studentId, []);
            }
            students.get(point.studentId)?.push(point);
        }

        const studentsWithPoints: {
            id: Id<"students">;
            name: string;
            points: number;
        }[] = [];

        for (const [studentId, points] of students.entries()) {
            const student = await ctx.db.get(studentId);
            if (!student) {
                throw new Error("User not found");
            }

            studentsWithPoints.push({
                id: student._id,
                name: student.name,
                points: points.reduce((acc, point) => acc + point.severity, 0),
            });
        }

        studentsWithPoints.sort((a, b) => b.points - a.points);
        return studentsWithPoints;
    },
});

/**
 * Fetches the current student with linked user data.
 *
 * @throws - An error if the current user has no linked student record.
 * @returns {Doc<"students"> & Doc<"users">} - The merged student and user data.
 */
export const getCurrent = query({
    handler: async (ctx) => {
        const user = await getCurrentUserOrThrow(ctx);

        const student = await ctx.db
            .query("students")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();

        if (!student) {
            throw new Error("Student not found for the user");
        }

        return {
            ...student,
            ...user,
        };
    },
});

/**
 * Fetches a student by id with selected linked user data.
 *
 * @param {Id<"students">} id - The id of the student to fetch.
 *
 * @throws - An error if the student or linked user cannot be found.
 * @returns {{ id: Id<"students">, userId: Id<"users">, email: string, firstName: string, lastName: string, studyProgram: string, year: number, degree: string }} - The resolved student payload.
 */
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
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            studyProgram: student.studyProgram,
            year: student.year,
            degree: student.degree,
        };
    },
});
