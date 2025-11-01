import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

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

		const userId = await ctx.runMutation(internal.users.createIfNotExists, {
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
