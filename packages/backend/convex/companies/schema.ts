import { defineTable } from "convex/server";
import { v } from "convex/values";

export const companiesSchema = {
    companies: defineTable({
        orgNumber: v.number(),
        name: v.string(),
        description: v.string(),
        mainSponsor: v.boolean(),
        logo: v.id("companyLogos"),
    }).searchIndex("search_name", {
        searchField: "name",
    }),

    companyLogos: defineTable({
        name: v.string(),
        image: v.id("_storage"),
    }),
}