import type { OrganizerRole } from "@workspace/shared/constants";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import type { ChannelEvent } from "./messages";

const DAY = 24 * 60 * 60 * 1000;
// A calendar month is at most 31 days; the extra day covers daylight-saving shifts.
const LOOKAHEAD = 32 * DAY;
const BATCH = 100;
const MAX_ORGANIZERS = 50;

export type Organizer = { userId: Id<"users">; name: string; email: string; role: OrganizerRole };

export type ActiveChannel = Pick<
	Doc<"bedpresChannels">,
	| "_id"
	| "channelId"
	| "sentReminders"
	| "invitedUserIds"
	| "reportedMissingUserIds"
	| "reportNotifiedAt"
> & {
	// Null when the event has been deleted.
	event: ChannelEvent | null;
	organizers: Organizer[];
	feedback: FeedbackReport;
};

// "none" without a feedback campaign, "waiting" until its report is ready for approval.
export type FeedbackReport =
	| { status: "none" }
	| { status: "waiting" }
	| { status: "ready"; responses: number };

// These queries only read data. Every Oslo-time rule runs in the Node sync action, because
// @date-fns/tz computes in UTC inside Convex's default runtime.

async function channelEvent(ctx: QueryCtx, event: Doc<"events">): Promise<ChannelEvent> {
	const company = await ctx.db.get(event.hostingCompany);
	return {
		title: event.title,
		company: company?.name ?? "bedriften",
		eventStart: event.eventStart,
		registrationOpens: event.registrationOpens,
		slug: event.slug ?? event._id,
	};
}

async function organizers(ctx: QueryCtx, eventId: Id<"events">): Promise<Organizer[]> {
	const rows = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
		.take(MAX_ORGANIZERS);
	const result: Organizer[] = [];
	for (const { userId, role } of rows) {
		const user = await ctx.db.get(userId);
		if (user)
			result.push({ userId, role, email: user.email, name: `${user.firstName} ${user.lastName}` });
	}
	return result;
}

async function feedbackReport(ctx: QueryCtx, eventId: Id<"events">): Promise<FeedbackReport> {
	const campaign = await ctx.db
		.query("feedbackCampaigns")
		.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
		.order("desc")
		.first();
	if (!campaign || campaign.status === "cancelled") return { status: "none" };
	const report = await ctx.db
		.query("feedbackReports")
		.withIndex("by_campaignId", (index) => index.eq("campaignId", campaign._id))
		.first();
	if (!report || report.status === "building") return { status: "waiting" };
	return { status: "ready", responses: report.totalResponses };
}

/** Upcoming events without a channel; the sync action decides whether a month is left. */
export const eventsNeedingChannels = internalQuery({
	args: { now: v.number() },
	handler: async (ctx, { now }): Promise<(ChannelEvent & { eventId: Id<"events"> })[]> => {
		const upcoming = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (index) =>
				index.gt("eventStart", now).lte("eventStart", now + LOOKAHEAD),
			)
			.take(BATCH);
		const result = [];
		for (const event of upcoming) {
			if (event.externalEvent) continue;
			const existing = await ctx.db
				.query("bedpresChannels")
				.withIndex("by_eventId", (index) => index.eq("eventId", event._id))
				.first();
			if (!existing) result.push({ eventId: event._id, ...(await channelEvent(ctx, event)) });
		}
		return result;
	},
});

export const activeChannels = internalQuery({
	args: {},
	handler: async (ctx): Promise<ActiveChannel[]> => {
		const channels = await ctx.db
			.query("bedpresChannels")
			.withIndex("by_status", (index) => index.eq("status", "active"))
			.take(BATCH);
		const result: ActiveChannel[] = [];
		for (const channel of channels) {
			const { _id, channelId, sentReminders, invitedUserIds, reportedMissingUserIds } = channel;
			const base = {
				_id,
				channelId,
				sentReminders,
				invitedUserIds,
				reportedMissingUserIds,
				reportNotifiedAt: channel.reportNotifiedAt,
			};
			const event = await ctx.db.get(channel.eventId);
			result.push({
				...base,
				event: event && (await channelEvent(ctx, event)),
				organizers: event ? await organizers(ctx, event._id) : [],
				feedback: await feedbackReport(ctx, channel.eventId),
			});
		}
		return result;
	},
});

export const recordChannel = internalMutation({
	args: { eventId: v.id("events"), channelId: v.string(), channelName: v.string() },
	handler: async (ctx, args): Promise<void> => {
		await ctx.db.insert("bedpresChannels", {
			...args,
			status: "active",
			sentReminders: [],
			invitedUserIds: [],
			reportedMissingUserIds: [],
		});
	},
});

export const recordProgress = internalMutation({
	args: {
		channelId: v.id("bedpresChannels"),
		sentReminders: v.optional(v.array(v.string())),
		invitedUserIds: v.optional(v.array(v.id("users"))),
		reportedMissingUserIds: v.optional(v.array(v.id("users"))),
		reportNotifiedAt: v.optional(v.number()),
		archived: v.optional(v.boolean()),
	},
	handler: async (ctx, { channelId, archived, reportNotifiedAt, ...added }): Promise<void> => {
		const channel = await ctx.db.get(channelId);
		if (!channel) return;
		await ctx.db.patch(channelId, {
			sentReminders: [...new Set([...channel.sentReminders, ...(added.sentReminders ?? [])])],
			invitedUserIds: [...new Set([...channel.invitedUserIds, ...(added.invitedUserIds ?? [])])],
			reportedMissingUserIds: [
				...new Set([...channel.reportedMissingUserIds, ...(added.reportedMissingUserIds ?? [])]),
			],
			...(reportNotifiedAt === undefined ? {} : { reportNotifiedAt }),
			...(archived ? { status: "archived" as const, archivedAt: Date.now() } : {}),
		});
	},
});
