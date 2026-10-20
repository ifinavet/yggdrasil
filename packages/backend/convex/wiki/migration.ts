import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { HANDBOOK_ARTICLES } from "./content";
import { articleSnapshot, indexedArticle, resourceBySlug, saveRevision } from "./helpers";

function legacySlug(resource: Doc<"resources">) {
	if (resource.title.toLocaleLowerCase("nb") === "hvordan holde bedpress") return "holde-bedpress";
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
	const replacement =
		slug === "holde-bedpress" ? HANDBOOK_ARTICLES.find((article) => article.slug === slug) : null;
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
async function seedArticles(ctx: MutationCtx, userId: Id<"users">) {
	await Promise.all(
		HANDBOOK_ARTICLES.map(async (article) => {
			if (await resourceBySlug(ctx, article.slug)) return;
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
		}),
	);
}
/** Resume-safe import. Reserve canonical slugs before parallel writes in each bounded batch. */
async function importBatch(ctx: MutationCtx, userId: Id<"users">) {
	const legacy = await ctx.db
		.query("resources")
		.withIndex("by_slug", (q) => q.eq("slug", undefined))
		.take(10);
	const reserved = new Set<string>();
	const imports = legacy.map((resource) => {
		const desired = legacySlug(resource);
		const slug = reserved.has(desired) ? `ressurs-${resource._id}` : desired;
		reserved.add(slug);
		return { resource, slug };
	});
	await Promise.all(
		imports.map(({ resource, slug }) => importResource(ctx, resource, userId, slug)),
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
