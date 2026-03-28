import { defineTable } from "convex/server";
import { v } from "convex/values";

export const pointsSchema = {
    points: defineTable({
        studentId: v.id("students"),
        reason: v.string(),
        severity: v.number(),
    }).index("by_studentId", ["studentId"]),
}