import type { WikiArticle } from "@workspace/shared/wiki";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { HANDBOOK_ARTICLES } from "./content";
import { articleSnapshot, indexedArticle, resourceBySlug, saveRevision } from "./helpers";

function legacySlug(resource: Doc<"resources">) {
	if (/^hvordan holde bedpress?$/i.test(resource.title.trim())) return "holde-bedpress";
	if (/rett?ningslinjer/i.test(resource.title)) return "retningslinjer-interne";
	return `ressurs-${resource._id}`;
}
async function importResource(
	ctx: MutationCtx,
	resource: Doc<"resources">,
	userId: Id<"users">,
	desiredSlug: string,
) {
	const old = articleSnapshot(resource);
	const slug = (await resourceBySlug(ctx, desiredSlug)) ? old.slug : desiredSlug;
	await saveRevision(ctx, resource._id, old, 0, "Opprinnelig ressurs");
	const policy = /rett?ningslinjer/i.test(resource.title);
	const category = policy ? "members" : "tools";
	const bedpress = legacySlug(resource) === "holde-bedpress";
	const replacement =
		bedpress && slug === "holde-bedpress"
			? HANDBOOK_ARTICLES.find((article) => article.slug === slug)
			: undefined;
	const article: WikiArticle = replacement ?? {
		...old,
		slug,
		category: bedpress ? "events" : category,
	};
	await ctx.db.patch(resource._id, {
		...indexedArticle(article),
		published: bedpress && !replacement ? false : resource.published,
		editVersion: 1,
		updatedAt: Date.now(),
	});
	await saveRevision(
		ctx,
		resource._id,
		article,
		1,
		bedpress ? "Erstattet utdatert bedpress-guide" : "Importert uten tekstendringer",
		userId,
	);
}
async function seedArticles(ctx: MutationCtx, userId: Id<"users">) {
	await Promise.all(
		HANDBOOK_ARTICLES.map(async (article) => {
			if (await resourceBySlug(ctx, article.slug)) return;
			const id = await ctx.db.insert("resources", {
				...indexedArticle(article),
				published: true,
				editVersion: 1,
				updatedAt: Date.now(),
			});
			await saveRevision(ctx, id, article, 1, "Opprettet fra håndbokgrunnlaget", userId);
		}),
	);
}
async function importBatch(ctx: MutationCtx, userId: Id<"users">) {
	const legacy = await ctx.db
		.query("resources")
		.withIndex("by_slug", (q) => q.eq("slug", undefined))
		.take(10);
	const reserved = new Set<string>();
	await Promise.all(
		legacy.map((resource) => {
			let slug = legacySlug(resource);
			if (reserved.has(slug)) slug = `ressurs-${resource._id}`;
			reserved.add(slug);
			return importResource(ctx, resource, userId, slug);
		}),
	);
	if (legacy.length === 10) {
		await ctx.scheduler.runAfter(0, internal.wiki.migration.continueImport, { userId });
		return;
	}
	await seedArticles(ctx, userId);
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
