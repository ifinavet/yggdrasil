import { REMINDER_INFO_MAX_LENGTH } from "@workspace/shared/events/reminder";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { DAY_MS } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { enqueueSystemMessage } from "../../iam/notifications";
import { escapeSlack, eventUrl } from "../slack/messages";
import { reminderRecipients, reviewedReminder, reviewedReminderDelivered } from "./queries";
import { REVIEWED_REMINDER_KIND } from "./schedule";

async function saveInfo(
	ctx: MutationCtx,
	eventId: Id<"events">,
	userId: Id<"users">,
	rawText: string,
) {
	const text = rawText.trim();
	if (text.length > REMINDER_INFO_MAX_LENGTH)
		throw new ConvexError(`Teksten kan ikke være lengre enn ${REMINDER_INFO_MAX_LENGTH} tegn.`);
	const existing = await ctx.db
		.query("eventReminderInfo")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.unique();
	if (!text) {
		if (existing) await ctx.db.delete(existing._id);
		return;
	}
	if (existing?.text === text) return;
	const fields = { text, updatedAt: Date.now(), updatedBy: userId };
	if (existing) await ctx.db.patch(existing._id, fields);
	else await ctx.db.insert("eventReminderInfo", { eventId, ...fields });
}

export const saveReminderInfo = mutation({
	args: { eventId: v.id("events"), text: v.string() },
	handler: async (ctx, { eventId, text }) => {
		const user = await requireRole(ctx, internalRoles);
		if (!(await ctx.db.get(eventId))) throw new ConvexError("Arrangementet finnes ikke.");
		await saveInfo(ctx, eventId, user._id, text);
	},
});

async function requireSendableEvent(ctx: MutationCtx, eventId: Id<"events">) {
	const event = await ctx.db.get(eventId);
	if (!event) throw new ConvexError("Arrangementet finnes ikke.");
	if (!event.published || event.externalEvent)
		throw new ConvexError("Påminnelser sendes bare for publiserte arrangementer hos Navet.");
	if (event.eventStart <= Date.now()) throw new ConvexError("Arrangementet har allerede startet.");
	if ((await reminderRecipients(ctx, eventId)).length === 0)
		throw new ConvexError("Ingen er påmeldt ennå.");
}

async function queueReviewedReminder(ctx: MutationCtx, eventId: Id<"events">) {
	await ctx.scheduler.runAfter(0, internal.events.reminders.emails.sendEventReminder, {
		eventId,
		kind: REVIEWED_REMINDER_KIND,
	});
}

export const approveEventReminder = mutation({
	args: { eventId: v.id("events"), text: v.string() },
	handler: async (ctx, { eventId, text }) => {
		const user = await requireRole(ctx, internalRoles);
		await requireSendableEvent(ctx, eventId);
		if (await reviewedReminder(ctx, eventId))
			throw new ConvexError("Påminnelsen er allerede sendt.");
		await saveInfo(ctx, eventId, user._id, text);
		await ctx.db.patch(eventId, { remindersEnabled: true });
		await ctx.db.insert("eventReminders", {
			eventId,
			kind: REVIEWED_REMINDER_KIND,
			queuedAt: Date.now(),
			approvedBy: user._id,
		});
		await queueReviewedReminder(ctx, eventId);
	},
});

export const retryEventReminder = mutation({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		await requireSendableEvent(ctx, eventId);
		if (!(await reviewedReminder(ctx, eventId)))
			throw new ConvexError("Påminnelsen er ikke godkjent.");
		if (await reviewedReminderDelivered(ctx, eventId))
			throw new ConvexError("Påminnelsen er allerede sendt.");
		await ctx.db.patch(eventId, { remindersEnabled: true });
		await queueReviewedReminder(ctx, eventId);
	},
});

function missingReminderText(event: Doc<"events">, approved: boolean) {
	return [
		"🚨 *Ingen påminnelsesmail ble sendt*",
		`*Arrangement:* ${escapeSlack(event.title)}`,
		approved
			? "Påminnelsen ble godkjent, men ingen mail ble levert."
			: "De ansvarlige godkjente aldri påminnelsesmailen i Bifrost, så de påmeldte fikk ingen påminnelse.",
		`<${eventUrl(event)}|Åpne arrangementet>`,
	].join("\n");
}

export const alertMissingReminders = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const started = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (index) =>
				index.gt("eventStart", now - DAY_MS).lte("eventStart", now),
			)
			.take(200);
		const alertable = started.filter((event) => event.published && !event.externalEvent);
		await Promise.all(
			alertable.map(async (event) => {
				const [reminder, delivered] = await Promise.all([
					reviewedReminder(ctx, event._id),
					reviewedReminderDelivered(ctx, event._id),
				]);
				const approved = reminder !== null;
				if (approved && delivered) return;
				await enqueueSystemMessage(ctx, {
					channel: SYSTEM_ALERTS_CHANNEL,
					clientMsgId: `reminder-missing-${event._id}-${event.eventStart}`,
					text: missingReminderText(event, approved),
				});
			}),
		);
	},
});
