import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { internalQuery, type QueryCtx, query } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";

type Signature = { name: string; position?: string; email: string };

const FALLBACK_SIGNATURE: Signature = { name: "Navet", email: EVENT_CONTACT_EMAIL };

export const getEventReminders = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Arrangementet finnes ikke.");
		return { enabled: event.remindersEnabled === true };
	},
});

export const emailContext = internalQuery({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId);
		if (!event?.remindersEnabled || !event.published || event.externalEvent) return null;
		if (event.eventStart <= Date.now()) return null;
		const company = await ctx.db.get(event.hostingCompany);
		if (!company) return null;
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (index) =>
				index.eq("eventId", eventId).eq("status", "registered"),
			)
			.take(500);
		const users = await Promise.all(registrations.map(({ userId }) => ctx.db.get(userId)));
		return {
			company: company.name,
			eventStart: event.eventStart,
			time: formatOsloDate(event.eventStart, DATE_PATTERNS.dateTime),
			location: event.location,
			signature: await reminderSignature(ctx, eventId),
			recipients: users.flatMap((user) =>
				user && !user.deleted ? [{ userId: user._id, email: user.email }] : [],
			),
		};
	},
});

async function reminderSignature(ctx: QueryCtx, eventId: Id<"events">): Promise<Signature> {
	const organizers = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
		.take(20);
	const lead = organizers.find(({ role }) => role === "hovedansvarlig");
	const user = lead && (await ctx.db.get(lead.userId));
	if (!user || user.deleted) return FALLBACK_SIGNATURE;
	const internal = await ctx.db
		.query("internals")
		.withIndex("by_userId", (index) => index.eq("userId", user._id))
		.first();
	return {
		name: `${user.firstName} ${user.lastName}`,
		position: internal?.position,
		email: internal?.positionEmail ?? user.email,
	};
}
