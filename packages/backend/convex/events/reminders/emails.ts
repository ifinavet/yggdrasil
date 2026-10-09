"use node";

import { pretty, render } from "@react-email/render";
import EventReminderEmail from "@workspace/emails/event-reminder-email";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action, internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { oneOf } from "../../lib/validators";
import { REMINDER_KINDS } from "./schedule";

export const sendEventReminder = internalAction({
	args: { eventId: v.id("events"), kind: oneOf(REMINDER_KINDS) },
	handler: async (ctx, { eventId, kind }) => {
		const context = await ctx.runQuery(internal.events.reminders.queries.emailContext, { eventId });
		if (!context) return;
		const { recipients, eventStart, ...content } = context;
		const html = await renderReminder(content);
		if (isLocalDevelopment()) {
			console.log(`Skipping ${recipients.length} ${kind} reminders for ${eventId} locally`);
			return;
		}
		for await (const recipient of recipients) {
			try {
				await ctx.runMutation(internal.events.reminders.delivery.enqueue, {
					eventId,
					eventStart,
					kind,
					userId: recipient.userId,
					replyTo: content.signature.email,
					to: recipient.email,
					subject: reminderSubject(content),
					html,
				});
			} catch (error) {
				console.error(`Could not queue ${kind} reminder for ${recipient.userId}`, error);
			}
		}
	},
});

type ReminderContent = Parameters<typeof EventReminderEmail>[0];
type ReminderContext = ReminderContent & {
	recipients: unknown[];
	eventStart: number;
};

function reminderSubject({ company, time }: ReminderContent) {
	return `Bedriftspresentasjon med ${company} ${time}`;
}

async function renderReminder(content: ReminderContent) {
	return pretty(await render(EventReminderEmail(content)));
}

export const previewEventReminder = action({
	args: { eventId: v.id("events"), info: v.string() },
	handler: async (
		ctx,
		{ eventId, info },
	): Promise<{ subject: string; html: string; recipients: number } | null> => {
		const context: ReminderContext | null = await ctx.runQuery(
			internal.events.reminders.queries.previewContext,
			{ eventId },
		);
		if (!context) return null;
		const { recipients, eventStart: _, ...content } = context;
		const preview = { ...content, info: info.trim() };
		return {
			subject: reminderSubject(preview),
			html: await renderReminder(preview),
			recipients: recipients.length,
		};
	},
});
