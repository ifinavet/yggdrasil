import { COMPANY_FIRST_CONTACT_TEMPLATE_URL } from "@workspace/shared/constants";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import {
	DAY_MS,
	EVENT_PLANNING,
	eventPlanningAt,
	eventSemesterOf,
	eventSemesterRange,
	MINUTE_MS,
} from "@workspace/shared/time";
import { asciiSlug } from "@workspace/shared/utils";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../../_generated/server";
import { followupFinishedAt } from "../../feedback/reports/lifecycle";
import { getOrganizers } from "../queries";
import { lifecycleEnabled } from "./config";
import { eventMessage, eventUrl, timedOrganizerReminders, welcomeMessage } from "./messages";

export async function queueEventNotification(
	ctx: MutationCtx,
	eventId: Id<"events">,
	key: string,
	text: string,
) {
	if (!lifecycleEnabled()) return;
	const event = await ctx.db.get(eventId);
	if (!event || event.externalEvent) return;
	const existing = await ctx.db
		.query("eventSlackNotifications")
		.withIndex("by_eventId_and_key", (q) => q.eq("eventId", eventId).eq("key", key))
		.unique();
	if (existing) return;
	await ctx.db.insert("eventSlackNotifications", {
		eventId,
		key,
		text,
		eventStart: event.eventStart,
	});
	await ctx.scheduler.runAfter(0, internal.events.slack.lifecycle.reconcile, {});
}

export const discover = internalMutation({
	args: { now: v.number(), paginationOpts: paginationOptsValidator },
	handler: async (ctx, { now, paginationOpts }) => {
		const events = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) => q.gt("eventStart", now))
			.paginate(paginationOpts);
		for (const event of events.page) {
			if (
				event.externalEvent ||
				eventPlanningAt(event.eventStart, EVENT_PLANNING.channelDaysBefore) > now
			)
				continue;
			const { semester, year } = eventSemesterOf(event.eventStart);
			const { start, end } = eventSemesterRange(semester, year);
			const existing = await ctx.db
				.query("companySemesterSlackChannels")
				.withIndex("by_companyId_and_semesterStart", (q) =>
					q.eq("companyId", event.hostingCompany).eq("semesterStart", start),
				)
				.unique();
			if (existing) continue;
			const company = await ctx.db.get(event.hostingCompany);
			if (!company) continue;
			let name =
				`${semester === "vår" ? "v" : "h"}${String(year).slice(-2)}-${asciiSlug(company.name)}`.slice(
					0,
					80,
				);
			if (
				await ctx.db
					.query("companySemesterSlackChannels")
					.withIndex("by_name", (q) => q.eq("name", name))
					.unique()
			)
				name = `${name.slice(0, 70)}-${event.hostingCompany.slice(-8)}`;
			await ctx.db.insert("companySemesterSlackChannels", {
				companyId: event.hostingCompany,
				semesterStart: start,
				semesterEnd: end,
				name,
				archived: false,
			});
		}
		return { isDone: events.isDone, continueCursor: events.continueCursor };
	},
});

export const listChannels = internalQuery({
	args: { paginationOpts: paginationOptsValidator },
	handler: (ctx, { paginationOpts }) =>
		ctx.db.query("companySemesterSlackChannels").paginate(paginationOpts),
});

export const claim = internalMutation({
	args: { channelId: v.id("companySemesterSlackChannels"), token: v.string() },
	handler: async (ctx, { channelId, token }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel || (channel.leaseUntil ?? 0) > Date.now() || (channel.retryAt ?? 0) > Date.now())
			return null;
		await ctx.db.patch(channelId, { leaseUntil: Date.now() + 10 * MINUTE_MS, leaseToken: token });
		return channel;
	},
});

export const progress = internalMutation({
	args: {
		channelId: v.id("companySemesterSlackChannels"),
		token: v.string(),
		slackChannelId: v.optional(v.string()),
		archived: v.optional(v.boolean()),
		release: v.optional(v.boolean()),
		notificationId: v.optional(v.id("eventSlackNotifications")),
		error: v.optional(v.string()),
		succeeded: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{ channelId, token, slackChannelId, archived, release, notificationId, error, succeeded },
	) => {
		const channel = await ctx.db.get(channelId);
		if (channel?.leaseToken !== token) throw new Error("Slack channel lease expired");
		if (error) {
			const failureCount = (channel.failureCount ?? 0) + 1;
			await ctx.db.patch(channelId, {
				failureCount,
				lastError: error,
				retryAt: Date.now() + Math.min(DAY_MS, 2 ** failureCount * 10 * MINUTE_MS),
			});
			if (failureCount === 1)
				await ctx.scheduler.runAfter(0, internal.iam.notifications.sendMessage, {
					channel: SYSTEM_ALERTS_CHANNEL,
					clientMsgId: `channel-error-${channelId}`,
					text: `Jeg får ikke oppdatert #${channel.name}. Sjekk Slack-tilgangene og konfigurasjonen i Convex. Jeg prøver igjen senere.`,
				});
		}
		if (succeeded)
			await ctx.db.patch(channelId, {
				failureCount: undefined,
				retryAt: undefined,
				lastError: undefined,
			});
		if (notificationId) await ctx.db.patch(notificationId, { sentAt: Date.now() });
		await ctx.db.patch(channelId, {
			...(slackChannelId && { slackChannelId }),
			...(archived !== undefined && { archived }),
			leaseUntil: release ? undefined : Date.now() + 10 * MINUTE_MS,
			...(release && { leaseToken: undefined }),
		});
	},
});

export const context = internalMutation({
	args: { channelId: v.id("companySemesterSlackChannels"), now: v.number() },
	handler: async (ctx, { channelId, now }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) return null;
		const companyEvents = await ctx.db
			.query("events")
			.withIndex("by_hostingCompany_and_eventStart", (q) =>
				q
					.eq("hostingCompany", channel.companyId)
					.gte("eventStart", channel.semesterStart)
					.lt("eventStart", channel.semesterEnd),
			)
			.collect();
		const events = companyEvents.filter((e) => !e.externalEvent);
		const members = new Set<string>();
		let finishedAt: number | null = 0;
		const messages: { id: Id<"eventSlackNotifications">; text: string }[] = [];
		for (const event of events) {
			const followup = await followupFinishedAt(ctx, event);
			finishedAt =
				finishedAt === null || followup === null
					? null
					: Math.max(finishedAt, event.eventStart, followup);
			const organizers = await getOrganizers(ctx, event._id);
			for (const organizer of organizers)
				if (organizer.slackUserId) members.add(organizer.slackUserId);
			if (eventPlanningAt(event.eventStart, EVENT_PLANNING.channelDaysBefore) > now) continue;
			if (event.eventStart > now) {
				await queueEventNotification(
					ctx,
					event._id,
					`welcome:${channel._id}:${event.eventStart}`,
					"Så hyggelig at dere skal arrangere! 👋 Her holder jeg dere oppdatert underveis. Kanalen deles med de andre arrangementene med samme bedrift dette semesteret.",
				);
			}
			if (
				event.eventStart > now &&
				eventPlanningAt(event.eventStart, EVENT_PLANNING.companyContactDaysBefore) <= now &&
				now < eventPlanningAt(event.eventStart, EVENT_PLANNING.companyContactDaysBefore) + DAY_MS
			) {
				await queueEventNotification(
					ctx,
					event._id,
					`company-contact:${event.eventStart}`,
					`Nå er det på tide å ta kontakt med bedriften 😊 Send dem en e-post og avklar det praktiske. Her er <${COMPANY_FIRST_CONTACT_TEMPLATE_URL}|malen for førstegangskontakt fra Ressurser>.`,
				);
			}
			for (const reminder of timedOrganizerReminders(event)) {
				if (now >= reminder.at && now < reminder.at + DAY_MS)
					await queueEventNotification(
						ctx,
						event._id,
						`${reminder.key}:${event.eventStart}`,
						reminder.text,
					);
			}
			const notifications = await ctx.db
				.query("eventSlackNotifications")
				.withIndex("by_eventId_and_key", (q) => q.eq("eventId", event._id))
				.collect();
			for (const notification of notifications)
				if (!notification.sentAt && !notification.cancelledAt)
					messages.push({
						id: notification._id,
						text: eventMessage(event, organizers, notification.text),
					});
		}
		// Every event in this company semester contributes, including events more than five weeks away.
		const archive =
			events.length === 0 ||
			(finishedAt !== null && now >= finishedAt + EVENT_PLANNING.archiveDaysAfter * DAY_MS);
		return { members: [...members], messages, archive };
	},
});

/** Re-read source state immediately before each external message, so stale jobs are harmless. */
export const notification = internalMutation({
	args: {
		channelId: v.id("companySemesterSlackChannels"),
		notificationId: v.id("eventSlackNotifications"),
		now: v.number(),
	},
	handler: async (ctx, { channelId, notificationId, now }) => {
		if (!lifecycleEnabled()) return null;
		const [channel, notice] = await Promise.all([
			ctx.db.get(channelId),
			ctx.db.get(notificationId),
		]);
		if (!channel || !notice || notice.sentAt || notice.cancelledAt) return null;
		const event = await ctx.db.get(notice.eventId);
		if (
			!event ||
			event.externalEvent ||
			event.eventStart !== notice.eventStart ||
			(notice.key.startsWith("reminder-sent:") && !event.remindersEnabled)
		) {
			await ctx.db.patch(notice._id, { cancelledAt: now });
			return null;
		}
		if (
			event.hostingCompany !== channel.companyId ||
			event.eventStart < channel.semesterStart ||
			event.eventStart >= channel.semesterEnd
		)
			return null;
		if (
			notice.key.startsWith("registration-open:") &&
			(!event.published ||
				event.registrationOpens > now ||
				notice.key !== `registration-open:${event.registrationOpens}`)
		) {
			await ctx.db.patch(notice._id, { cancelledAt: now });
			return null;
		}
		if (
			!notice.key.startsWith("welcome:") &&
			!notice.key.startsWith("report-") &&
			now - notice._creationTime > DAY_MS
		) {
			await ctx.db.patch(notice._id, { cancelledAt: now });
			return null;
		}
		const text = notice.key.startsWith("welcome:")
			? welcomeMessage(event, now)
			: notice.key.startsWith("report-ready:")
				? `${notice.text} <${eventUrl(event)}/report|Åpne rapporten>.`
				: notice.text;
		const organizers = await getOrganizers(ctx, event._id);
		const recipients =
			notice.key.startsWith("practical:") || notice.key.startsWith("expenses:")
				? organizers.filter(({ role }) => role === "hovedansvarlig")
				: organizers;
		return { id: notice._id, text: eventMessage(event, recipients, text) };
	},
});
