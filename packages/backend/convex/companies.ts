import { v } from "convex/values";
import { query } from "./_generated/server";

export const getAll = query({
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").collect();
    return companies;
  }
})

export const getById = query({
  args: {
    id: v.id("companies"),
  },
  handler: async (ctx, { id }) => {
    const company = await ctx.db.get(id);
    if (!company) {
      throw new Error(`Company with ID ${id} not found`);
    }
    return company;
  },
});
