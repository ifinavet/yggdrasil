import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Uploads may be reused across retries, company profiles and review history. */
export async function deleteUnreferencedOrderLogo(ctx: MutationCtx, storageId: Id<"_storage">) {
	const references = await Promise.all([
		ctx.db
			.query("companyLogos")
			.withIndex("by_image", (q) => q.eq("image", storageId))
			.first(),
		ctx.db
			.query("jobListingOrders")
			.withIndex("by_newCompany_logo", (q) => q.eq("newCompany.logo", storageId))
			.first(),
		ctx.db
			.query("jobListingOrders")
			.withIndex("by_companyChanges_logo", (q) => q.eq("companyChanges.logo", storageId))
			.first(),
	]);
	if (references.every((reference) => reference === null)) await ctx.storage.delete(storageId);
}
