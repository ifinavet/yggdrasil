import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { getAccessRole, internalRoles } from "../../auth/accessRights";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

export async function requireReportAccess(ctx: QueryCtx, eventId: Id<"events">) {
	const user = await getCurrentUserOrThrow(ctx);
	const role = await getAccessRole(ctx, user._id);
	if (role === "super-admin") return user;
	const organizer = await ctx.db.query("eventOrganizers")
		.withIndex("by_eventId_and_userId", (index) => index.eq("eventId", eventId).eq("userId", user._id)).first();
	if (!role || !internalRoles.includes(role) || !organizer)
		throw new ConvexError("Du må være arrangør for dette arrangementet for å se rapporten.");
	return user;
}

export function isReportFeatureEnabled(): boolean {
	return process.env.FEEDBACK_REPORTS_ENABLED === "true";
}
