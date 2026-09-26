import { defineTable } from "convex/server";
import { v } from "convex/values";

export const companyBilling = v.object({
	address: v.string(),
	email: v.string(),
	reference: v.string(),
});

export const companiesSchema = {
	companies: defineTable({
		orgNumber: v.number(),
		name: v.string(),
		description: v.string(),
		mainSponsor: v.boolean(),
		logo: v.id("companyLogos"),
		registryName: v.optional(v.string()),
		billing: v.optional(companyBilling),
	})
		.index("by_orgNumber", ["orgNumber"])
		.searchIndex("search_name", {
			searchField: "name",
		}),

	companyLogos: defineTable({
		name: v.string(),
		image: v.id("_storage"),
	}),
};
