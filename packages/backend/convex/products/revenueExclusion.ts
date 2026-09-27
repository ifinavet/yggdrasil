import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";

export const MAX_EXCLUDED_PER_BATCH = 200;

export const setRevenueExclusion = mutation({
	args: { companyIds: v.array(v.id("companies")), excluded: v.boolean() },
	handler: async (ctx, { companyIds, excluded }) => {
		await requireRole(ctx, adminRoles);
		if (companyIds.length === 0 || companyIds.length > MAX_EXCLUDED_PER_BATCH) {
			throw new ConvexError(`Velg mellom 1 og ${MAX_EXCLUDED_PER_BATCH} bedrifter.`);
		}

		for (const companyId of companyIds) {
			const company = await ctx.db.get(companyId);
			if (!company) throw new ConvexError("Bedriften ble ikke funnet.");
			await ctx.db.patch(companyId, { excludedFromRevenue: excluded });
		}
		return companyIds.length;
	},
});
