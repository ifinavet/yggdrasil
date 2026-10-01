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
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../../_generated/server";
import { latestCampaign } from "../../feedback/delivery/campaigns";
import { followupFinishedAt } from "../../feedback/reports/lifecycle";
import { countRegistrationsWithStatus } from "../helper";
import { getOrganizers } from "../queries";
import { lifecycleEnabled } from "./config";
import { escapeSlack, eventMessage, eventUrl, welcomeMessage } from "./messages";
import { recoverableNotices } from "./recovery";
import { dueOrganizerReminders } from "./reminders";

export async function queueEventNotification(
	ctx: MutationCtx,
	eventId: Id<"events">,
	key: string,
	text: string,
	options: { condition?: string; schedule?: boolean } = {},
) {
	const event = await ctx.db.get(eventId);
	if (!event || event.externalEvent) return;
	const existing = await ctx.db
		.query("eventSlackNotifications")
		.withIndex("by_eventId_and_key", (q) => q.eq("eventId", eventId).eq("key", key))
		.unique();
	if (existing?.sentAt) return;
	if (options.condition) {
		const sent = await ctx.db
			.query("eventSlackNotifications")
			.withIndex("by_eventId_and_key", (q) => q.eq("eventId", eventId))
			.filter((q) =>
				q.and(q.eq(q.field("condition"), options.condition), q.neq(q.field("sentAt"), undefined)),
			)
			.first();
		if (sent) return;
	}
	if (existing && !(key === "registration-full" && existing.cancelledAt)) {
		if (existing.cancelledAt || existing.eventStart !== event.eventStart) {
			await ctx.db.patch(existing._id, {
				eventStart: event.eventStart,
				text,
				condition: options.condition,
				cancelledAt: undefined,
				retryAt: undefined,
			});
		}
		return;
	}
	if (existing) await ctx.db.delete(existing._id);
	await ctx.db.insert("eventSlackNotifications", {
		eventId,
		key,
		text,
		eventStart: event.eventStart,
		condition: options.condition,
	});
	if (options.schedule !== false && lifecycleEnabled())
		await ctx.scheduler.runAfter(0, internal.events.slack.lifecycle.reconcile, {});
}

export const discover = internalMutation({
	args: { now: v.number(), paginationOpts: paginationOptsValidator },
	handler: async (ctx, { now, paginationOpts }) => {
		const events = await ctx.db.query("events").withIndex("by_eventStart").paginate(paginationOpts);
		for await (const event of events.page) {
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
			if (event.eventStart <= now) {
				const finishedAt = await followupFinishedAt(ctx, event);
				if (
					finishedAt !== null &&
					now >= Math.max(event.eventStart, finishedAt) + EVENT_PLANNING.archiveDaysAfter * DAY_MS
				)
					continue;
			}
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
		if (
			!channel ||
			(channel.leaseUntil ?? 0) > Date.now() ||
			(!channel.slackChannelId && (channel.retryAt ?? 0) > Date.now())
		)
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
		notificationError: v.optional(v.string()),
		managedSlackUserIds: v.optional(v.array(v.string())),
		creationNoticeChannelId: v.optional(v.string()),
		error: v.optional(v.string()),
		succeeded: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{
			channelId,
			token,
			slackChannelId,
			archived,
			release,
			notificationId,
			notificationError,
			error,
			succeeded,
			managedSlackUserIds,
			creationNoticeChannelId,
		},
	) => {
		const channel = await ctx.db.get(channelId);
		if (channel?.leaseToken !== token) throw new Error("Slack channel lease expired");
		if (error) {
			const failureCount = (channel.failureCount ?? 0) + 1;
			await ctx.db.patch(channelId, {
				failureCount,
				lastError: error,
				retryAt: Date.now() + Math.min(15 * MINUTE_MS, 2 ** Math.min(failureCount, 4) * MINUTE_MS),
			});
		}
		if (creationNoticeChannelId) await ctx.db.patch(channelId, { creationNoticeChannelId });
		if (managedSlackUserIds) await ctx.db.patch(channelId, { managedSlackUserIds });
		if (succeeded)
			await ctx.db.patch(channelId, {
				failureCount: undefined,
				retryAt: undefined,
				lastError: undefined,
			});
		if (notificationId) {
			const notice = await ctx.db.get(notificationId);
			if (!notice) throw new Error("Slack notification missing");
			const failureCount = (notice.failureCount ?? 0) + 1;
			await ctx.db.patch(
				notificationId,
				notificationError !== undefined
					? {
							failureCount,
							lastError: notificationError,
							retryAt:
								Date.now() + Math.min(15 * MINUTE_MS, 2 ** Math.min(failureCount, 4) * MINUTE_MS),
						}
					: {
							sentAt: Date.now(),
							retryAt: undefined,
							failureCount: undefined,
							lastError: undefined,
						},
			);
		}
		await ctx.db.patch(channelId, {
			...(slackChannelId && { slackChannelId }),
			...(archived !== undefined && { archived }),
			leaseUntil: release ? undefined : Date.now() + 10 * MINUTE_MS,
			...(release && { leaseToken: undefined }),
		});
	},
});

async function eventContext(
	ctx: MutationCtx,
	event: Doc<"events">,
	channel: Doc<"companySemesterSlackChannels">,
	now: number,
) {
	const followup = await followupFinishedAt(ctx, event);
	const finishedAt = followup === null ? null : Math.max(event.eventStart, followup);
	const organizers = await getOrganizers(ctx, event._id);
	const members = organizers.flatMap((organizer) =>
		organizer.slackUserId ? [organizer.slackUserId] : [],
	);
	if (
		event.eventStart > now &&
		eventPlanningAt(event.eventStart, EVENT_PLANNING.channelDaysBefore) <= now
	)
		await queueEventNotification(
			ctx,
			event._id,
			`welcome:${channel._id}:${channel.generation ?? 1}`,
			"",
			{ schedule: false },
		);
	if (event.eventStart > now || followup === null)
		await Promise.all(
			organizers
				.filter((organizer) => !organizer.slackUserId)
				.map((organizer) =>
					queueEventNotification(
						ctx,
						event._id,
						`missing-slack:${organizer.userId}`,
						`Jeg finner ingen aktiv Slack-konto for ${escapeSlack(organizer.name)}. Koble kontoen i medlemsadministrasjonen, så legger jeg dem til her.`,
						{ schedule: false },
					),
				),
		);

	await Promise.all(
		(await recoverableNotices(ctx, event, now)).map((notice) =>
			queueEventNotification(ctx, event._id, notice.key, notice.text, { schedule: false }),
		),
	);
	const reminders = await dueOrganizerReminders(ctx, event, now);
	await Promise.all(
		reminders.map((reminder) =>
			queueEventNotification(ctx, event._id, `${reminder.key}:${event.eventStart}`, reminder.text, {
				condition: reminder.key,
				schedule: false,
			}),
		),
	);
	const notifications = await ctx.db
		.query("eventSlackNotifications")
		.withIndex("by_eventId_and_key", (q) => q.eq("eventId", event._id))
		.collect();
	const messages = notifications
		.filter((notice) => !notice.sentAt && !notice.cancelledAt)
		.map((notice) => ({ id: notice._id }));
	return {
		members,
		finishedAt,
		messages,
		actionable:
			(event.eventStart > now &&
				eventPlanningAt(event.eventStart, EVENT_PLANNING.channelDaysBefore) <= now) ||
			followup === null,
	};
}

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
		const contexts = await Promise.all(
			events.map((event) => eventContext(ctx, event, channel, now)),
		);
		const members = new Set(contexts.flatMap((context) => context.members));
		const messages = contexts.flatMap((context) => context.messages);
		const unfinished = contexts.some((context) => context.finishedAt === null);
		const finishedAt = unfinished
			? null
			: Math.max(0, ...contexts.map((context) => context.finishedAt ?? 0));

		// Every event in this company semester contributes, including events more than five weeks away.
		const archive =
			events.length === 0 ||
			(finishedAt !== null && now >= finishedAt + EVENT_PLANNING.archiveDaysAfter * DAY_MS);
		return {
			members: [...members],
			actionable: contexts.some((context) => context.actionable),
			messages,
			archive,
			finishedAt,
			companyName: (await ctx.db.get(channel.companyId))?.name ?? channel.name,
		};
	},
});

async function staleFeedbackNotification(
	ctx: MutationCtx,
	event: Doc<"events">,
	notice: Doc<"eventSlackNotifications">,
) {
	if (!notice.key.startsWith("feedback-sent:")) return false;
	if (!event.feedbackEnabled) return true;
	const campaign = await ctx.db.get(notice.key.split(":")[1] as Id<"feedbackCampaigns">);
	return !campaign || campaign.status === "cancelled";
}

async function reportNotificationText(
	ctx: MutationCtx,
	event: Doc<"events">,
	notice: Doc<"eventSlackNotifications">,
) {
	if (notice.key.startsWith("report-ready:") || notice.key.startsWith("report-sent:")) {
		const report = await ctx.db.get(notice.key.split(":")[1] as Id<"feedbackReports">);
		if (
			!report ||
			(notice.key.startsWith("report-ready:") && report.status !== "draft") ||
			(notice.key.startsWith("report-sent:") &&
				(report.status !== "approved" ||
					report.deliveryStatus === "failed" ||
					report.followupFinishedAt === undefined ||
					notice.key !== `report-sent:${report._id}:${report.deliveryAttempt ?? 0}`))
		) {
			return null;
		}
		if (notice.key.startsWith("report-ready:") && report.totalResponses > 0) {
			return `${notice.text} <${eventUrl(event)}/report|Åpne rapporten>.`;
		}
	}
	return notice.text;
}

async function staleNotification(
	ctx: MutationCtx,
	event: Doc<"events">,
	notice: Doc<"eventSlackNotifications">,
	now: number,
) {
	if (
		notice.key.startsWith("registration-open:") &&
		(!event.published ||
			event.eventStart <= now ||
			event.registrationOpens > now ||
			notice.key !== `registration-open:${event.registrationOpens}`)
	) {
		return true;
	}
	if (notice.key.startsWith("unregister-wave:") && now - notice._creationTime > DAY_MS) {
		return true;
	}
	if (
		notice.key === "registration-full" &&
		(event.eventStart <= now ||
			!event.published ||
			(await countRegistrationsWithStatus(ctx, event._id, "registered")) < event.participationLimit)
	) {
		return true;
	}

	return staleFeedbackNotification(ctx, event, notice);
}

function staleWelcome(
	event: Doc<"events">,
	channel: Doc<"companySemesterSlackChannels">,
	notice: Doc<"eventSlackNotifications">,
	now: number,
) {
	return (
		notice.key.startsWith("welcome:") &&
		(event.eventStart <= now || notice.key !== `welcome:${channel._id}:${channel.generation ?? 1}`)
	);
}

async function renderNotification(
	ctx: MutationCtx,
	event: Doc<"events">,
	notice: Doc<"eventSlackNotifications">,
	text: string,
	now: number,
) {
	if (notice.key.startsWith("welcome:")) {
		const campaign = await latestCampaign(ctx, event._id);
		const active = campaign?.status === "scheduled" || campaign?.status === "open";
		text = welcomeMessage(event, now, active ? campaign.opensAt : undefined);
	}
	if (notice.key.startsWith("report-ready:") || notice.key.startsWith("report-sent:")) {
		const reportText = await reportNotificationText(ctx, event, notice);
		if (reportText === null) {
			await ctx.db.patch(notice._id, { cancelledAt: now });
			return null;
		}
		text = reportText;
	}

	const organizers = await getOrganizers(ctx, event._id);
	if (notice.key.startsWith("missing-slack:")) {
		const missingId = notice.key.slice("missing-slack:".length);
		if (!organizers.some((organizer) => organizer.userId === missingId && !organizer.slackUserId)) {
			await ctx.db.patch(notice._id, { cancelledAt: now });
			return null;
		}
	}
	const recipients =
		notice.key.startsWith("practical:") ||
		notice.key.startsWith("expenses:") ||
		notice.key.startsWith("missing-attendance:")
			? organizers.filter(({ role }) => role === "hovedansvarlig")
			: organizers;
	return {
		id: notice._id,
		createdAt: notice._creationTime,
		text: eventMessage(event, recipients, text),
	};
}

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
		if (!channel || !notice || notice.sentAt || notice.cancelledAt || (notice.retryAt ?? 0) > now)
			return null;
		const event = await ctx.db.get(notice.eventId);
		if (
			!event ||
			event.externalEvent ||
			event.eventStart !== notice.eventStart ||
			(notice.key.startsWith("reminder-sent:") && !event.remindersEnabled) ||
			staleWelcome(event, channel, notice, now)
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
		if (await staleNotification(ctx, event, notice, now)) {
			await ctx.db.patch(notice._id, { cancelledAt: now });
			return null;
		}

		const conditional = notice.condition
			? (await dueOrganizerReminders(ctx, event, now)).find(
					(reminder) => reminder.key === notice.condition,
				)
			: null;
		if (notice.condition && !conditional) {
			await ctx.db.patch(notice._id, { cancelledAt: now });
			return null;
		}
		return renderNotification(ctx, event, notice, conditional?.text ?? notice.text, now);
	},
});

/** Slack bot tokens cannot unarchive. Reserve one replacement generation before creating it. */
export const replaceArchivedChannel = internalMutation({
	args: { channelId: v.id("companySemesterSlackChannels"), token: v.string() },
	handler: async (ctx, { channelId, token }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel || channel.leaseToken !== token) throw new Error("Slack channel lease expired");
		const generation = (channel.generation ?? 1) + 1;
		await ctx.db.patch(channelId, {
			generation,
			slackChannelId: undefined,
			archived: false,
			managedSlackUserIds: [],
		});
		return {
			...channel,
			generation,
			slackChannelId: undefined,
			archived: false,
			managedSlackUserIds: [],
		};
	},
});
