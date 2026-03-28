import { defineTable } from "convex/server";
import { v } from "convex/values";

export const studentsSchema = {
    students: defineTable({
        userId: v.id("users"),
        name: v.string(),
        studyProgram: v.string(),
        semester: v.optional(v.number()),
        year: v.number(),
        degree: v.union(
            v.literal("Årsstudium"),
            v.literal("Bachelor"),
            v.literal("Master"),
            v.literal("PhD"),
        ),
    })
        .index("by_studyProgram", ["studyProgram"])
        .index("by_userId", ["userId"])
        .searchIndex("search_name", {
            searchField: "name",
        }),
}