import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";

export async function requireAdmissionPeriod(
	ctx: QueryCtx | MutationCtx,
	periodId: Id<"admissionPeriods">,
): Promise<Doc<"admissionPeriods">> {
	await requireRole(ctx, adminRoles);
	const period = await ctx.db.get(periodId);
	if (!period) throw new ConvexError("Fant ikke opptaksperioden.");
	return period;
}

export async function requireMutablePeriod(
	ctx: MutationCtx,
	periodId: Id<"admissionPeriods">,
): Promise<Doc<"admissionPeriods">> {
	const period = await requireAdmissionPeriod(ctx, periodId);
	if (period.status === "closing") throw new ConvexError("Opptaksperioden er stengt.");
	return period;
}
