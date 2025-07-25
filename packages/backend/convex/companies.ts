import { query } from "./_generated/server";

export const allCompanies = query({
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").collect();
    return companies;
  }
})
