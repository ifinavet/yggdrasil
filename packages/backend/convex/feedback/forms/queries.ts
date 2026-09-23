import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import { internalRoles, requireRole, superAdminRoles } from "../../auth/accessRights";
import { getFormOrThrow, latestVersion } from "./helpers";

export const list = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, { paginationOpts }) => {
		await requireRole(ctx, internalRoles);
		const results = await ctx.db.query("feedbackForms").order("desc").paginate(paginationOpts);
		return {
			...results,
			page: await Promise.all(
				results.page.map(async (form) => ({
					_id: form._id,
					name: form.name,
					isDefault: form.isDefault,
					publishedVersion: await latestVersion(ctx, form._id),
				})),
			),
		};
	},
});

export const getDraft = query({
	args: { formId: v.id("feedbackForms") },
	handler: async (ctx, { formId }) => {
		await requireRole(ctx, superAdminRoles);
		return await getFormOrThrow(ctx, formId);
	},
});

export const getVersion = query({
	args: { versionId: v.id("formVersions") },
	handler: async (ctx, { versionId }) => {
		await requireRole(ctx, internalRoles);
		const version = await ctx.db.get(versionId);
		if (!version) throw new ConvexError("Skjemaversjonen finnes ikke.");
		const fields = await ctx.db
			.query("formFields")
			.withIndex("by_formVersionId_and_order", (q) => q.eq("formVersionId", versionId))
			.take(40);
		return { ...version, fields };
	},
});

export const getDefault = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		const form = await ctx.db
			.query("feedbackForms")
			.withIndex("by_isDefault", (q) => q.eq("isDefault", true))
			.unique();
		if (!form) return null;
		return { formId: form._id, publishedVersion: await latestVersion(ctx, form._id) };
	},
});
