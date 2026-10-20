import { type WikiArticle, wikiArticleSchema } from "@workspace/shared/wiki";
import { ConvexError } from "convex/values";
import { FilterXSS } from "xss";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { sanitizeRichText } from "../jobListingOrders/sanitize";

const textFilter = new FilterXSS({
	whiteList: {},
	stripIgnoreTag: true,
	stripIgnoreTagBody: ["script", "style"],
});
const entities: Record<string, string> = {
	"&nbsp;": " ",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};
export function plainText(html: string) {
	return textFilter
		.process(html.replaceAll("><", "> <"))
		.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => entities[entity] ?? " ")
		.replace(/\s+/g, " ")
		.trim();
}
export function validateArticle(value: WikiArticle) {
	const result = wikiArticleSchema.safeParse(value);
	if (!result.success)
		throw new ConvexError(result.error.issues[0]?.message ?? "Kontroller artikkelen.");
	return { ...result.data, content: sanitizeRichText(result.data.content) };
}
export function indexedArticle(article: WikiArticle) {
	const text = plainText(article.content);
	return {
		...article,
		plainText: text,
		searchText: [article.title, article.excerpt, ...article.aliases, text].join("\n"),
	};
}
export function articleSnapshot(resource: Doc<"resources">): WikiArticle {
	return {
		title: resource.title,
		slug: resource.slug ?? `ressurs-${resource._id}`,
		excerpt: resource.excerpt,
		content: resource.content,
		category: resource.category ?? "tools",
		aliases: resource.aliases ?? [],
		facts: resource.facts ?? [],
	};
}
export function resourceBySlug(ctx: QueryCtx, slug: string) {
	return ctx.db
		.query("resources")
		.withIndex("by_slug", (q) => q.eq("slug", slug))
		.unique();
}
export async function saveRevision(
	ctx: MutationCtx,
	resourceId: Id<"resources">,
	article: WikiArticle,
	number: number,
	action: string,
	createdBy?: Id<"users">,
) {
	await ctx.db.insert("wikiRevisions", {
		resourceId,
		article,
		number,
		action,
		createdAt: Date.now(),
		...(createdBy ? { createdBy } : {}),
	});
}
export function articleSummary(resource: Doc<"resources">) {
	return {
		_id: resource._id,
		slug: resource.slug ?? "",
		title: resource.title,
		excerpt: resource.excerpt,
		category: resource.category ?? "tools",
		updatedAt: resource.updatedAt,
	};
}
