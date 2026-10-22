import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { articleSummary, joinHyphenatedWords, resourceBySlug } from "./helpers";

export const browse = query({
	args: {
		query: v.string(),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		await requireRole(ctx, internalRoles);
		const term = joinHyphenatedWords(args.query.trim().slice(0, 200));
		const rows = term
			? await ctx.db
					.query("resources")
					.withSearchIndex("search_wiki", (q) => q.search("searchText", term).eq("published", true))
					.paginate(args.paginationOpts)
			: await ctx.db
					.query("resources")
					.withIndex("by_published_and_title", (q) => q.eq("published", true))
					.filter((q) => q.neq(q.field("slug"), undefined))
					.paginate(args.paginationOpts);
		return { ...rows, page: rows.page.map(articleSummary) };
	},
});
export const get = query({
	args: { slug: v.string() },
	handler: async (ctx, { slug }) => {
		await requireRole(ctx, internalRoles);
		const resource = await resourceBySlug(ctx, slug);
		return resource?.published ? resource : null;
	},
});
