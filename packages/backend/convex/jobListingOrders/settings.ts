import {
	JOB_LISTING_ORDER_DEFAULTS,
	type JobListingOrderSettings,
	jobListingOrderSettingsSchema,
} from "@workspace/shared/job-listing-orders";
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { orderSettingsFields } from "./schema";

const settingsValidator = v.object(orderSettingsFields);

export async function loadOrderSettings(ctx: QueryCtx): Promise<JobListingOrderSettings> {
	const latest = await ctx.db.query("jobListingOrderFormVersions").order("desc").first();
	if (!latest) return JOB_LISTING_ORDER_DEFAULTS;
	const { intro, jobTypes, titleMaxLength, teaserMaxLength, open } = latest;
	return { intro, jobTypes, titleMaxLength, teaserMaxLength, open };
}

export const current = query({
	args: {},
	returns: settingsValidator,
	handler: (ctx) => loadOrderSettings(ctx),
});

export const internalCurrent = internalQuery({
	args: {},
	returns: settingsValidator,
	handler: (ctx) => loadOrderSettings(ctx),
});

export const save = mutation({
	args: { settings: settingsValidator },
	returns: v.null(),
	handler: async (ctx, { settings }) => {
		const user = await requireRole(ctx, adminRoles);
		const parsed = jobListingOrderSettingsSchema.safeParse(settings);
		if (!parsed.success) {
			throw new ConvexError(parsed.error.issues[0]?.message ?? "Innstillingene er ugyldige.");
		}
		await ctx.db.insert("jobListingOrderFormVersions", { ...parsed.data, createdBy: user._id });
		return null;
	},
});
