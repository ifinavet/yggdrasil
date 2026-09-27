import { defineTable } from "convex/server";
import { v } from "convex/values";

export const usersSchema = {
	users: defineTable({
		email: v.string(),
		firstName: v.string(),
		lastName: v.string(),
		image: v.string(),
		externalId: v.string(),
		locked: v.boolean(),
		deleted: v.optional(v.boolean()),
	})
		.index("by_ExternalId", ["externalId"])
		.searchIndex("search_email", {
			searchField: "email",
		}),
	deletedClerkUsers: defineTable({
		externalIdHash: v.string(),
	}).index("by_externalIdHash", ["externalIdHash"]),
};
