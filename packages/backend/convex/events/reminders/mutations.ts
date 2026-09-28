import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, mutation } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { dueReminder, REMINDER_LEAD_TIMES } from "./schedule";

export const setEventReminders = mutation({
	args: { eventId: v.id("events"), enabled: v.boolean() },
	handler: async (ctx, { eventId, enabled }) => {
		await requireRole(ctx, internalRoles);
		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Arrangementet finnes ikke.");
		await ctx.db.patch(eventId, { remindersEnabled: enabled });
	},
});

export const queueDueReminders = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const upcoming = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (index) =>
				index.gt("eventStart", now).lte("eventStart", now + REMINDER_LEAD_TIMES.week),
			)
			.take(200);
		for (const event of upcoming) {
			if (event.remindersEnabled !== true || !event.published || event.externalEvent) continue;
			const kind = dueReminder(event.eventStart, now);
			if (!kind) continue;
			const queued = await ctx.db
				.query("eventReminders")
				.withIndex("by_eventId_and_kind", (index) =>
					index.eq("eventId", event._id).eq("kind", kind),
				)
				.first();
			if (queued) continue;
			await ctx.db.insert("eventReminders", { eventId: event._id, kind, queuedAt: now });
			await ctx.scheduler.runAfter(0, internal.events.reminders.emails.sendEventReminder, {
				eventId: event._id,
				kind,
			});
		}
	},
});
