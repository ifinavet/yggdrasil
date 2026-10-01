import { v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import { internalMutation } from "../../_generated/server";
import { feedbackResend, feedbackSender } from "../../feedback/delivery/messages";
import { oneOf } from "../../lib/validators";
import { reminderSentText } from "../slack/messages";
import { queueEventNotification } from "../slack/state";
import { dueReminder, REMINDER_KINDS } from "./schedule";

const batchArgs = { eventId: v.id("events"), kind: oneOf(REMINDER_KINDS) };
export const enqueue = internalMutation({
	args: {
		...batchArgs,
		eventStart: v.number(),
		userId: v.id("users"),
		to: v.string(),
		replyTo: v.string(),
		subject: v.string(),
		html: v.string(),
	},
	handler: async (
		ctx,
		{ eventId, eventStart, kind, userId, to, replyTo, subject, html },
	): Promise<void> => {
		const event = await ctx.db.get(eventId);
		if (
			!event?.remindersEnabled ||
			!event.published ||
			event.externalEvent ||
			event.eventStart !== eventStart ||
			dueReminder(event.eventStart, Date.now()) !== kind
		)
			return;
		const existing = await ctx.db
			.query("eventReminderDeliveries")
			.withIndex("by_eventId_and_kind_and_userId", (q) =>
				q.eq("eventId", eventId).eq("kind", kind).eq("userId", userId),
			)
			.unique();
		if (existing) return;
		const emailId = await feedbackResend.sendEmail(ctx, {
			...feedbackSender,
			replyTo: [replyTo],
			to,
			subject,
			html,
			idempotencyKey: `reminder:${eventId}:${kind}:${userId}`,
		});
		await ctx.db.insert("eventReminderDeliveries", {
			eventId,
			eventStart,
			kind,
			userId,
			emailId,
			sent: false,
		});
	},
});

/** Provider callbacks, never enqueue success, confirm that a reminder batch was sent. */
export async function recordReminderSent(ctx: MutationCtx, emailId: string, type: string) {
	const delivery = await ctx.db
		.query("eventReminderDeliveries")
		.withIndex("by_emailId", (q) => q.eq("emailId", emailId))
		.unique();
	if (!delivery) return false;
	if (delivery.sent || (type !== "email.sent" && type !== "email.delivered")) return true;
	await ctx.db.patch(delivery._id, { sent: true, sentAt: Date.now() });
	const event = await ctx.db.get(delivery.eventId);
	if (!event || event.eventStart !== delivery.eventStart || !event.remindersEnabled) return true;
	await queueEventNotification(
		ctx,
		delivery.eventId,
		`reminder-sent:${delivery.kind}`,
		reminderSentText(delivery.kind),
	);
	return true;
}
