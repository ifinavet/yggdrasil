import { searchSnippet, WIKI_CATEGORY_KEYS, wikiReviewReasons } from "@workspace/shared/wiki";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { oneOf } from "../lib/validators";
import {
	articleSnapshot,
	articleSummary,
	requireResource,
	resourceBySlug,
	sourceInfo,
} from "./helpers";

export const browse = query({
	args: {
		query: v.string(),
		category: v.optional(oneOf(WIKI_CATEGORY_KEYS)),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		await requireRole(ctx, internalRoles);
		const term = args.query.trim().slice(0, 200);
		const rows = term
			? await ctx.db
					.query("resources")
					.withSearchIndex("search_wiki", (q) => {
						const search = q.search("searchText", term).eq("wikiStatus", "published");
						return args.category ? search.eq("category", args.category) : search;
					})
					.paginate(args.paginationOpts)
			: await (args.category
					? ctx.db
							.query("resources")
							.withIndex("by_wikiStatus_and_category_and_updatedAt", (q) =>
								q.eq("wikiStatus", "published").eq("category", args.category),
							)
					: ctx.db
							.query("resources")
							.withIndex("by_wikiStatus_and_updatedAt", (q) => q.eq("wikiStatus", "published"))
				)
					.order("desc")
					.paginate(args.paginationOpts);
		return {
			...rows,
			page: rows.page.map((row) => ({
				...articleSummary(row),
				snippet: term ? searchSnippet(row.plainText ?? row.excerpt, term) : row.excerpt,
			})),
		};
	},
});
export const home = query({
	args: {},
	handler: async (ctx) => {
		const user = await requireRole(ctx, internalRoles);
		const bookmarks = await ctx.db
			.query("wikiBookmarks")
			.withIndex("by_userId_and_resourceId", (q) => q.eq("userId", user._id))
			.order("desc")
			.take(12);
		const saved = await Promise.all(bookmarks.map((bookmark) => ctx.db.get(bookmark.resourceId)));
		const recent = await ctx.db
			.query("resources")
			.withIndex("by_wikiStatus_and_updatedAt", (q) => q.eq("wikiStatus", "published"))
			.order("desc")
			.take(6);
		const recommended = await ctx.db
			.query("resources")
			.withIndex("by_favoriteAndUpdated", (q) => q.eq("favorite", true))
			.filter((q) => q.eq(q.field("wikiStatus"), "published"))
			.order("desc")
			.take(6);
		return {
			initialized: Boolean(await resourceBySlug(ctx, "holde-bedpress")),
			recent: recent.map(articleSummary),
			recommended: recommended.map(articleSummary),
			bookmarks: saved.flatMap((row) =>
				row?.wikiStatus === "published" ? [articleSummary(row)] : [],
			),
		};
	},
});
export const get = query({
	args: { slug: v.string() },
	handler: async (ctx, { slug }) => {
		const user = await requireRole(ctx, internalRoles);
		const resource = await resourceBySlug(ctx, slug);
		if (!resource) return null;
		const bookmark = await ctx.db
			.query("wikiBookmarks")
			.withIndex("by_userId_and_resourceId", (q) =>
				q.eq("userId", user._id).eq("resourceId", resource._id),
			)
			.unique();
		const related = await Promise.all(
			(resource.relatedSlugs ?? []).map((relatedSlug) => resourceBySlug(ctx, relatedSlug)),
		);
		const checkedBy = resource.lastCheckedBy ? await ctx.db.get(resource.lastCheckedBy) : null;
		const updatedBy = resource.updatedBy ? await ctx.db.get(resource.updatedBy) : null;
		return {
			...resource,
			article: articleSnapshot(resource),
			bookmarked: Boolean(bookmark),
			source: sourceInfo(slug),
			updatedByName: updatedBy ? `${updatedBy.firstName} ${updatedBy.lastName}`.trim() : null,
			checkedByName: checkedBy ? `${checkedBy.firstName} ${checkedBy.lastName}`.trim() : null,
			related: related.flatMap((row) =>
				row?.wikiStatus === "published" ? [articleSummary(row)] : [],
			),
		};
	},
});
export const edit = query({
	args: { slug: v.string() },
	handler: async (ctx, { slug }) => {
		await requireRole(ctx, internalRoles);
		const resource = await resourceBySlug(ctx, slug);
		if (!resource) return null;
		const draft = await ctx.db
			.query("wikiDrafts")
			.withIndex("by_resourceId", (q) => q.eq("resourceId", resource._id))
			.unique();
		return {
			resourceId: resource._id,
			article: draft?.article ?? articleSnapshot(resource),
			editVersion: resource.editVersion ?? 0,
			hasDraft: Boolean(draft),
			status: resource.wikiStatus,
		};
	},
});
export const history = query({
	args: { resourceId: v.id("resources"), paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		await requireRole(ctx, internalRoles);
		await requireResource(ctx, args.resourceId);
		return ctx.db
			.query("wikiRevisions")
			.withIndex("by_resourceId_and_number", (q) => q.eq("resourceId", args.resourceId))
			.order("desc")
			.paginate(args.paginationOpts);
	},
});
export const reviewQueue = query({
	args: {
		status: v.union(v.literal("published"), v.literal("draft"), v.literal("retired")),
		now: v.number(),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		await requireRole(ctx, internalRoles);
		const rows = await ctx.db
			.query("resources")
			.withIndex("by_wikiStatus_and_updatedAt", (q) => q.eq("wikiStatus", args.status))
			.order("desc")
			.paginate(args.paginationOpts);
		return {
			...rows,
			page: rows.page.map((row) => ({
				...articleSummary(row),
				reasons: wikiReviewReasons(row, sourceInfo(row.slug ?? "").hash, args.now),
			})),
		};
	},
});
export const reports = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		await requireRole(ctx, internalRoles);
		const rows = await ctx.db
			.query("wikiReports")
			.withIndex("by_resolved", (q) => q.eq("resolved", false))
			.order("desc")
			.paginate(args.paginationOpts);
		return {
			...rows,
			page: await Promise.all(
				rows.page.map(async (row) => {
					const article = await ctx.db.get(row.resourceId);
					return { ...row, slug: article?.slug, title: article?.title ?? "Ukjent artikkel" };
				}),
			),
		};
	},
});

export const bookmarks = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		const rows = await ctx.db
			.query("wikiBookmarks")
			.withIndex("by_userId_and_resourceId", (q) => q.eq("userId", user._id))
			.order("desc")
			.paginate(args.paginationOpts);
		const resources = await Promise.all(rows.page.map((row) => ctx.db.get(row.resourceId)));
		return {
			...rows,
			page: resources.flatMap((row) =>
				row?.wikiStatus === "published" ? [articleSummary(row)] : [],
			),
		};
	},
});
