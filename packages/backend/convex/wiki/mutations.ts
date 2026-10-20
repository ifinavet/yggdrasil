import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import {
	articleSnapshot,
	indexedArticle,
	requireResource,
	requireVersion,
	resourceBySlug,
	reviewDueAt,
	saveRevision,
	sourceInfo,
	validateArticle,
} from "./helpers";
import { articleValue } from "./schema";

export const save = mutation({
	args: {
		resourceId: v.optional(v.id("resources")),
		expectedVersion: v.number(),
		article: articleValue,
		publish: v.boolean(),
	},
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		const article = validateArticle(args.article);
		const existing = args.resourceId ? await requireResource(ctx, args.resourceId) : null;
		if (existing) {
			requireVersion(existing, args.expectedVersion);
			if (existing.slug !== article.slug)
				throw new ConvexError("Artikkelens adresse kan ikke endres.");
			if (existing.wikiStatus === "retired")
				throw new ConvexError("Gjenopprett en tidligere versjon før du redigerer artikkelen.");
		} else if (await resourceBySlug(ctx, article.slug))
			throw new ConvexError("Adressen brukes allerede av en annen artikkel.");
		const now = Date.now();
		const resourceId =
			existing?._id ??
			(await ctx.db.insert("resources", {
				...indexedArticle(article),
				published: false,
				wikiStatus: "draft",
				updatedAt: now,
				createdBy: user._id,
				revision: 0,
				editVersion: 0,
			}));
		const draft = await ctx.db
			.query("wikiDrafts")
			.withIndex("by_resourceId", (q) => q.eq("resourceId", resourceId))
			.unique();
		const editVersion = (existing?.editVersion ?? 0) + 1;
		if (args.publish) {
			const revision = editVersion;
			await ctx.db.patch(resourceId, {
				...indexedArticle(article),
				published: true,
				wikiStatus: "published",
				revision,
				editVersion,
				updatedAt: now,
				updatedBy: user._id,
				hasDraft: false,
				lastCheckedAt: undefined,
				lastCheckedBy: undefined,
				checkedSourceVersion: undefined,
				reviewDueAt: now,
				retirementNote: undefined,
				replacementSlug: undefined,
			});
			await saveRevision(ctx, resourceId, article, revision, "Publisert", user._id);
			if (draft) await ctx.db.delete(draft._id);
		} else {
			const values = { resourceId, article, updatedBy: user._id, updatedAt: now };
			if (draft) await ctx.db.patch(draft._id, values);
			else await ctx.db.insert("wikiDrafts", values);
			await saveRevision(ctx, resourceId, article, editVersion, "Utkast lagret", user._id);
			await ctx.db.patch(resourceId, { editVersion, hasDraft: true });
		}
		return { resourceId, slug: article.slug, editVersion };
	},
});
export const check = mutation({
	args: { resourceId: v.id("resources"), expectedVersion: v.number(), sourceVersion: v.string() },
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		const resource = await requireResource(ctx, args.resourceId);
		requireVersion(resource, args.expectedVersion);
		if (resource.wikiStatus !== "published")
			throw new ConvexError("Publiser artikkelen før du kontrollerer den.");
		const current = sourceInfo(resource.slug).hash;
		if (current !== args.sourceVersion)
			throw new ConvexError("Funksjonen er endret. Last inn og kontroller artikkelen på nytt.");
		const now = Date.now();
		await ctx.db.patch(resource._id, {
			lastCheckedAt: now,
			lastCheckedBy: user._id,
			checkedSourceVersion: current,
			reviewDueAt: reviewDueAt(now, resource.policy ?? false),
			editVersion: (resource.editVersion ?? 0) + 1,
		});
	},
});
export const restore = mutation({
	args: { revisionId: v.id("wikiRevisions"), expectedVersion: v.number() },
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		const revision = await ctx.db.get(args.revisionId);
		if (!revision) throw new ConvexError("Versjonen finnes ikke.");
		const resource = await requireResource(ctx, revision.resourceId);
		requireVersion(resource, args.expectedVersion);
		const draft = await ctx.db
			.query("wikiDrafts")
			.withIndex("by_resourceId", (q) => q.eq("resourceId", resource._id))
			.unique();
		const values = {
			resourceId: resource._id,
			article: { ...revision.article, slug: resource.slug },
			updatedAt: Date.now(),
			updatedBy: user._id,
		};
		if (draft) await ctx.db.patch(draft._id, values);
		else await ctx.db.insert("wikiDrafts", values);
		await saveRevision(
			ctx,
			resource._id,
			values.article,
			(resource.editVersion ?? 0) + 1,
			"Gjenopprettet utkast",
			user._id,
		);
		await ctx.db.patch(resource._id, {
			hasDraft: true,
			editVersion: (resource.editVersion ?? 0) + 1,
			...(resource.wikiStatus === "retired"
				? {
						wikiStatus: "draft" as const,
						published: false,
						replacementSlug: undefined,
						retirementNote: undefined,
					}
				: {}),
		});
	},
});
export const retire = mutation({
	args: {
		resourceId: v.id("resources"),
		expectedVersion: v.number(),
		note: v.string(),
		replacementSlug: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		const resource = await requireResource(ctx, args.resourceId);
		requireVersion(resource, args.expectedVersion);
		if (!args.note.trim() || args.note.length > 1000)
			throw new ConvexError("Beskriv hvorfor artikkelen tas ut av bruk (maks 1000 tegn).");
		if (args.replacementSlug) {
			const replacement = await resourceBySlug(ctx, args.replacementSlug);
			if (replacement?.wikiStatus !== "published" || replacement._id === resource._id)
				throw new ConvexError("Velg en annen publisert artikkel som erstatning.");
		}
		const revision = (resource.editVersion ?? 0) + 1;
		await saveRevision(
			ctx,
			resource._id,
			articleSnapshot(resource),
			revision,
			"Tatt ut av bruk",
			user._id,
		);
		await ctx.db.patch(resource._id, {
			wikiStatus: "retired",
			published: false,
			revision,
			editVersion: (resource.editVersion ?? 0) + 1,
			retirementNote: args.note.trim(),
			replacementSlug: args.replacementSlug,
			updatedAt: Date.now(),
			updatedBy: user._id,
		});
	},
});
export const bookmark = mutation({
	args: { resourceId: v.id("resources"), saved: v.boolean() },
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		await requireResource(ctx, args.resourceId);
		const existing = await ctx.db
			.query("wikiBookmarks")
			.withIndex("by_userId_and_resourceId", (q) =>
				q.eq("userId", user._id).eq("resourceId", args.resourceId),
			)
			.unique();
		if (args.saved && !existing)
			await ctx.db.insert("wikiBookmarks", { userId: user._id, resourceId: args.resourceId });
		if (!args.saved && existing) await ctx.db.delete(existing._id);
	},
});
export const report = mutation({
	args: { resourceId: v.id("resources"), message: v.string() },
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		const resource = await requireResource(ctx, args.resourceId);
		if (args.message.trim().length < 5 || args.message.length > 2000)
			throw new ConvexError("Beskriv feilen med 5 til 2000 tegn.");
		await ctx.db.insert("wikiReports", {
			resourceId: resource._id,
			revision: resource.revision ?? 0,
			message: args.message.trim(),
			createdBy: user._id,
			resolved: false,
		});
	},
});
export const resolveReport = mutation({
	args: { reportId: v.id("wikiReports") },
	handler: async (ctx, args) => {
		const user = await requireRole(ctx, internalRoles);
		await ctx.db.patch(args.reportId, {
			resolved: true,
			resolvedBy: user._id,
			resolvedAt: Date.now(),
		});
	},
});
