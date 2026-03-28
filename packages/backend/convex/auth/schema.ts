import { defineTable } from "convex/server";
import { v } from "convex/values";
import { accessRoles } from "./accessRights";

export const accessSchema = {
    accessRights: defineTable({
        userId: v.id("users"),
        role: accessRoles,
    })
        .index("by_userId", ["userId"])
        .index("by_role", ["role"]),
}