import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import { internalRoles, requireRole, superAdminRoles } from "../../auth/accessRights";
import { getFeedbackFormOrThrow, getLatestPublishedVersion } from "./helpers";

export const getFeedbackForms = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, { paginationOpts }) => {
		await requireRole(ctx, internalRoles);
		const formsPage = await ctx.db.query("feedbackForms").order("desc").paginate(paginationOpts);
		return {
			...formsPage,
			page: await Promise.all(
				formsPage.page.map(async (feedbackForm) => ({
					_id: feedbackForm._id,
					name: feedbackForm.name,
					isDefault: feedbackForm.isDefault,
					publishedVersion: await getLatestPublishedVersion(ctx, feedbackForm._id),
				})),
			),
		};
	},
});

export const getDraft = query({
	args: { formId: v.id("feedbackForms") },
	handler: async (ctx, { formId }) => {
		await requireRole(ctx, superAdminRoles);
		return await getFeedbackFormOrThrow(ctx, formId);
	},
});

export const getVersion = query({
	args: { versionId: v.id("formVersions") },
	handler: async (ctx, { versionId }) => {
		await requireRole(ctx, internalRoles);
		const publishedVersion = await ctx.db.get(versionId);
		if (!publishedVersion) throw new ConvexError("Skjemaversjonen finnes ikke.");
		const versionFields = await ctx.db
			.query("formFields")
			.withIndex("by_formVersionId_and_order", (index) => index.eq("formVersionId", versionId))
			.take(40);
		return { ...publishedVersion, fields: versionFields };
	},
});

export const getDefault = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		const feedbackForm = await ctx.db
			.query("feedbackForms")
			.withIndex("by_isDefault", (index) => index.eq("isDefault", true))
			.unique();
		if (!feedbackForm) return null;
		return {
			formId: feedbackForm._id,
			publishedVersion: await getLatestPublishedVersion(ctx, feedbackForm._id),
		};
	},
});
