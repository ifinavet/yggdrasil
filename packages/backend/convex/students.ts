import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

export const getAllPaged = query({
	args: {
		search: v.optional(v.string()),
		paginationOpts: paginationOptsValidator
	},
	handler: async (ctx, { search, paginationOpts }) => {
		const students = await (
			(search && search.length > 0) ?
				ctx.db
					.query("students")
					.withSearchIndex("search_name", (q) => q.search("name", search))
					.paginate(paginationOpts)
				: ctx.db
					.query("students")
					.paginate(paginationOpts)
		);

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
			semester: student.semester,
			degree: student.degree,
		};
	},
});

export const createByExternalId = mutation({
	args: {
		externalId: v.string(),
		degree: v.union(v.literal("Bachelor"), v.literal("Master"), v.literal("PhD")),
		semester: v.number(),
		studyProgram: v.string(),
		name: v.string(),
	},
	handler: async (ctx, { externalId, degree, semester, studyProgram, name }) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_ExternalId", (q) => q.eq("externalId", externalId))
			.first();

		let userId: Id<"users">;

		if (!user) {
			const identity = await ctx.auth.getUserIdentity();
			if (!identity) {
				throw new Error("Bruker identiteteten er ikke tilgjengelig. Kan ikke opprette bruker.");
			}

			const { familyName, givenName, email, pictureUrl } = identity;

			userId = await ctx.runMutation(internal.users.createIfNotExists, {
				externalId,
				firstName: givenName ?? "",
				lastName: familyName ?? "",
				email: email ?? "",
				image: pictureUrl ?? "",
			});
		} else {
			userId = user._id;
		}

		await ctx.db.insert("students", {
			userId,
			degree,
			semester,
			studyProgram,
			name,
		});
	},
});

export const updateCurrent = mutation({
	args: {
		semester: v.number(),
		studyProgram: v.string(),
		degree: v.union(v.literal("Bachelor"), v.literal("Master"), v.literal("PhD")),
	},
	handler: async (ctx, { semester, studyProgram, degree }) => {
		const user = await getCurrentUserOrThrow(ctx);

		const student = await ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.first();

		if (!student) {
			throw new Error("Student not found for the user");
		}

		await ctx.db.patch(student._id, {
			semester,
			studyProgram,
			degree,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("students"),
		semester: v.number(),
		studyProgram: v.string(),
		degree: v.union(v.literal("Bachelor"), v.literal("Master"), v.literal("PhD")),
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
