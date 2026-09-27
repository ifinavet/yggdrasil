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
	})
		.index("by_ExternalId", ["externalId"])
		.index("by_email", ["email"])
		.searchIndex("search_email", {
			searchField: "email",
		})
		.searchIndex("search_firstName", {
			searchField: "firstName",
		})
		.searchIndex("search_lastName", {
			searchField: "lastName",
		}),
};
