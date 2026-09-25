import { featureFlags } from "@workspace/shared/feature-flags";
import { reportAccessDeniedMessage } from "@workspace/shared/feedback/report";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { type AccessRole, getAccessRole, internalRoles } from "../../auth/accessRights";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

export function reportAccessAllowed(role: AccessRole | null, isOrganizer: boolean) {
	if (role === "super-admin") return true;
	return role !== null && internalRoles.includes(role) && isOrganizer;
}

async function hasReportAccess(ctx: QueryCtx, user: Doc<"users">, eventId: Id<"events">) {
	const role = await getAccessRole(ctx, user._id);
	if (reportAccessAllowed(role, false)) return true;
	if (!reportAccessAllowed(role, true)) return false;
	const organizer = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId_and_userId", (index) =>
			index.eq("eventId", eventId).eq("userId", user._id),
		)
		.first();
	return reportAccessAllowed(role, organizer !== null);
}

export async function canViewReport(ctx: QueryCtx, eventId: Id<"events">) {
	return hasReportAccess(ctx, await getCurrentUserOrThrow(ctx), eventId);
}

export async function requireReportAccess(ctx: QueryCtx, eventId: Id<"events">) {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await hasReportAccess(ctx, user, eventId)))
		throw new ConvexError(reportAccessDeniedMessage);
	return user;
}

export function isReportFeatureEnabled(): boolean {
	return featureFlags.huginFeedback.reportsEnabled;
}
