import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { HANDBOOK_ARTICLES } from "./content";
import { articleSnapshot, indexedArticle, resourceBySlug, saveRevision } from "./helpers";

/** Resume-safe import. Existing resource IDs, recommendations and original HTML survive. */
async function importBatch(ctx: MutationCtx, userId: Id<"users">) {
	const legacy = await ctx.db
		.query("resources")
		.withIndex("by_slug", (q) => q.eq("slug", undefined))
		.take(10);
	for (const resource of legacy) {
		const old = articleSnapshot(resource);
		const bedpress = resource.title.toLocaleLowerCase("nb") === "hvordan holde bedpress";
		const policy = /rett?ningslinjer/i.test(resource.title);
		const desiredSlug = bedpress ? "holde-bedpress" : policy ? "retningslinjer-interne" : old.slug;
		const slug = (await resourceBySlug(ctx, desiredSlug)) ? old.slug : desiredSlug;
		await saveRevision(ctx, resource._id, old, 0, "Opprinnelig ressurs");
		const replacement =
			bedpress && slug === "holde-bedpress"
				? HANDBOOK_ARTICLES.find((article) => article.slug === slug)
				: null;
		const article = replacement ?? {
			...old,
			slug,
			policy,
			category: policy ? ("members" as const) : ("tools" as const),
			owner: policy ? "HR-ansvarlig" : "Styret",
		};
		await ctx.db.patch(resource._id, {
			...indexedArticle(article),
			wikiStatus: resource.published ? "published" : "draft",
			revision: 1,
			editVersion: 1,
			hasDraft: false,
			updatedAt: Date.now(),
			updatedBy: userId,
			reviewDueAt: Date.now(),
		});
		await saveRevision(
			ctx,
			resource._id,
			article,
			1,
			replacement ? "Oppdatert bedpress-rutine" : "Importert uten tekstendringer",
			userId,
		);
	}
	if (legacy.length === 10) {
		await ctx.scheduler.runAfter(0, internal.wiki.migration.continueImport, { userId });
		return;
	}
	for (const article of HANDBOOK_ARTICLES) {
		if (await resourceBySlug(ctx, article.slug)) continue;
		const id = await ctx.db.insert("resources", {
			...indexedArticle(article),
			published: true,
			wikiStatus: "published",
			revision: 1,
			editVersion: 1,
			hasDraft: false,
			createdBy: userId,
			updatedBy: userId,
			updatedAt: Date.now(),
			reviewDueAt: Date.now(),
			favorite: ["holde-bedpress", "fakturering", "medlemskontoer"].includes(article.slug),
		});
		await saveRevision(ctx, id, article, 1, "Opprettet fra håndbokgrunnlaget", userId);
	}
}
export const initialize = mutation({
	args: {},
	handler: async (ctx) => {
		const user = await requireRole(ctx, internalRoles);
		await importBatch(ctx, user._id);
	},
});
export const continueImport = internalMutation({
	args: { userId: v.id("users") },
	handler: async (ctx, { userId }) => importBatch(ctx, userId),
});
