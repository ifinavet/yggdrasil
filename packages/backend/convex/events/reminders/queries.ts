import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { MIDGARD_LOCAL_URL, MIDGARD_URL } from "@workspace/shared/constants/urls";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalQuery, type QueryCtx, query } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { getCurrentUser } from "../../auth/currentUser";
import { isLocalDevelopment } from "../../auth/local";
import { getEventByIdentifier } from "../helper";
import { REVIEWED_REMINDER_KIND } from "./schedule";

type Signature = { name: string; position?: string; email: string };

const FALLBACK_SIGNATURE: Signature = { name: "Navet", email: EVENT_CONTACT_EMAIL };

export const getEventReminders = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Arrangementet finnes ikke.");
		const [reminder, info] = await Promise.all([
			reviewedReminder(ctx, eventId),
			reminderInfo(ctx, eventId),
		]);
		const approver = reminder?.approvedBy && (await ctx.db.get(reminder.approvedBy));
		return {
			sendable: event.published && !event.externalEvent && event.eventStart > Date.now(),
			info,
			approvedAt: reminder?.queuedAt ?? null,
			approvedBy: approver ? `${approver.firstName} ${approver.lastName}` : null,
			delivered: reminder ? await reviewedReminderDelivered(ctx, eventId) : false,
		};
	},
});

export async function reviewedReminder(ctx: QueryCtx, eventId: Id<"events">) {
	return ctx.db
		.query("eventReminders")
		.withIndex("by_eventId_and_kind", (q) =>
			q.eq("eventId", eventId).eq("kind", REVIEWED_REMINDER_KIND),
		)
		.unique();
}

export async function reviewedReminderDelivered(ctx: QueryCtx, eventId: Id<"events">) {
	const deliveries = await ctx.db
		.query("eventReminderDeliveries")
		.withIndex("by_eventId_and_kind_and_userId", (q) =>
			q.eq("eventId", eventId).eq("kind", REVIEWED_REMINDER_KIND),
		)
		.take(500);
	return deliveries.some(({ sent }) => sent);
}

export async function reminderRecipients(ctx: QueryCtx, eventId: Id<"events">) {
	const registrations = await ctx.db
		.query("registrations")
		.withIndex("by_eventIdStatusAndRegistrationTime", (index) =>
			index.eq("eventId", eventId).eq("status", "registered"),
		)
		.take(500);
	const users = await Promise.all(registrations.map(({ userId }) => ctx.db.get(userId)));
	return users.flatMap((user) =>
		user && !user.deleted ? [{ userId: user._id, email: user.email }] : [],
	);
}

async function reminderInfo(ctx: QueryCtx, eventId: Id<"events">) {
	const info = await ctx.db
		.query("eventReminderInfo")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.unique();
	return info?.text ?? "";
}

export const getOwnReminderInfo = query({
	args: { eventIdentifier: v.string() },
	handler: async (ctx, { eventIdentifier }) => {
		const user = await getCurrentUser(ctx);
		if (!user) return null;
		const event = await getEventByIdentifier(ctx, eventIdentifier);
		const registration = await ctx.db
			.query("registrations")
			.withIndex("by_eventId_and_userId", (q) => q.eq("eventId", event._id).eq("userId", user._id))
			.first();
		if (registration?.status !== "registered") return null;
		return (await reminderInfo(ctx, event._id)) || null;
	},
});

function publicEventUrl(event: Doc<"events">) {
	return `${isLocalDevelopment() ? MIDGARD_LOCAL_URL : MIDGARD_URL}/events/${event.slug ?? event._id}`;
}

export const emailContext = internalQuery({
	args: { eventId: v.id("events") },
	handler: (ctx, { eventId }) => loadEmailContext(ctx, eventId),
});

export const previewContext = internalQuery({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		return loadEmailContext(ctx, eventId);
	},
});

async function loadEmailContext(ctx: QueryCtx, eventId: Id<"events">) {
	const event = await ctx.db.get(eventId);
	if (!event?.published || event.externalEvent) return null;
	if (event.eventStart <= Date.now()) return null;
	const company = await ctx.db.get(event.hostingCompany);
	if (!company) return null;
	return {
		company: company.name,
		eventStart: event.eventStart,
		time: formatOsloDate(event.eventStart, DATE_PATTERNS.dateTime),
		location: event.location,
		info: await reminderInfo(ctx, eventId),
		eventUrl: publicEventUrl(event),
		signature: await reminderSignature(ctx, eventId),
		recipients: await reminderRecipients(ctx, eventId),
	};
}

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
