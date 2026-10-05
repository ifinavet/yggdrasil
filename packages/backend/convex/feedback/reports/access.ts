import { reportAccessDeniedMessage } from "@workspace/shared/feedback/report";
import { ConvexError } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { getAccessRole, internalRoles } from "../../auth/accessRights";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

async function hasReportAccess(ctx: QueryCtx, user: Doc<"users">) {
	const role = await getAccessRole(ctx, user._id);
	return role !== null && internalRoles.includes(role);
}

export async function canViewReport(ctx: QueryCtx) {
	return hasReportAccess(ctx, await getCurrentUserOrThrow(ctx));
}

export async function requireReportAccess(ctx: QueryCtx) {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await hasReportAccess(ctx, user))) throw new ConvexError(reportAccessDeniedMessage);
	return user;
}
