import { DEGREE_TYPES } from "@workspace/shared/constants";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const studentDegree = v.union(...DEGREE_TYPES.map((degree) => v.literal(degree)));

export const studentsSchema = {
	students: defineTable({
		userId: v.id("users"),
		name: v.string(),
		studyProgram: v.string(),
		semester: v.optional(v.number()),
		year: v.number(),
		degree: studentDegree,
		graduatedAt: v.optional(v.number()),
	})
		.index("by_studyProgram", ["studyProgram"])
		.index("by_userId", ["userId"])
		.searchIndex("search_name", {
			searchField: "name",
		}),
};
