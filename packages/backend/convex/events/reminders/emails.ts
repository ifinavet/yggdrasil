"use node";

import { pretty, render } from "@react-email/render";
import EventReminderEmail from "@workspace/emails/event-reminder-email";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { resend } from "../../emails";
import { oneOf } from "../../lib/validators";
import { REMINDER_KINDS } from "./schedule";

export const sendEventReminder = internalAction({
	args: { eventId: v.id("events"), kind: oneOf(REMINDER_KINDS) },
	handler: async (ctx, { eventId, kind }) => {
		const context = await ctx.runQuery(internal.events.reminders.queries.emailContext, { eventId });
		if (!context) return;
		const { recipients, ...content } = context;
		const html = await pretty(await render(EventReminderEmail(content)));
		if (isLocalDevelopment()) {
			console.log(`Skipping ${recipients.length} ${kind} reminders for ${eventId} locally`);
			return;
		}
		for (const recipient of recipients) {
			try {
				await resend.sendEmail(ctx, {
					from: "Navet <info@ifinavet.no>",
					replyTo: [content.signature.email],
					to: recipient.email,
					subject: `Bedriftspresentasjon med ${content.company} ${content.time}`,
					html,
					idempotencyKey: `reminder:${eventId}:${kind}:${recipient.userId}`,
				});
			} catch (error) {
				console.error(`Could not queue ${kind} reminder for ${recipient.userId}`, error);
			}
		}
	},
});
