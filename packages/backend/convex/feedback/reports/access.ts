import { featureFlags } from "@workspace/shared/feature-flags";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { getAccessRole, internalRoles } from "../../auth/accessRights";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

async function hasReportAccess(ctx: QueryCtx, user: Doc<"users">, eventId: Id<"events">) {
	const role = await getAccessRole(ctx, user._id);
	if (role === "super-admin") return true;
	if (!role || !internalRoles.includes(role)) return false;
	const organizer = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId_and_userId", (index) =>
			index.eq("eventId", eventId).eq("userId", user._id),
		)
		.first();
	return organizer !== null;
}

export async function canViewReport(ctx: QueryCtx, eventId: Id<"events">) {
	return hasReportAccess(ctx, await getCurrentUserOrThrow(ctx), eventId);
}

export async function requireReportAccess(ctx: QueryCtx, eventId: Id<"events">) {
	const user = await getCurrentUserOrThrow(ctx);
	if (!(await hasReportAccess(ctx, user, eventId)))
		throw new ConvexError("Du må være arrangør for dette arrangementet for å se rapporten.");
	return user;
}

export function isReportFeatureEnabled(): boolean {
	return featureFlags.huginFeedback.reportsEnabled;
}
