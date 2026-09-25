"use node";

// Node, because @date-fns/tz computes in UTC inside Convex's default runtime and every
// reminder and archive time here is in Oslo time.
import { featureFlags } from "@workspace/shared/feature-flags";
import { channelArchiveDeadline, channelOpensAt } from "@workspace/shared/slack/time";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import type { ActiveChannel } from "./channels";
import { SlackApiError, type SlackClient, slackClient } from "./client";
import {
	ARCHIVE_MESSAGE,
	type ChannelEvent,
	channelName,
	dueReminders,
	membersMessage,
	missingMemberMessage,
	reminderMessage,
	welcomeMessage,
} from "./messages";

const MAX_NAME_ATTEMPTS = 5;
const ARCHIVED_CODES = ["is_archived", "already_archived"];

async function createChannel(
	ctx: ActionCtx,
	slack: SlackClient,
	event: ChannelEvent & { eventId: Id<"events"> },
): Promise<void> {
	for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
		const name = channelName(event, attempt);
		try {
			const channelId = await slack.createPrivateChannel(name);
			// Record before posting anything, so a later failure never creates a second channel.
			await ctx.runMutation(internal.slack.channels.recordChannel, {
				eventId: event.eventId,
				channelId,
				channelName: name,
			});
			return;
		} catch (error) {
			if (!(error instanceof SlackApiError && error.code === "name_taken")) throw error;
		}
	}
	throw new Error(`No free Slack channel name for event ${event.eventId}`);
}

/** Slack IDs for SLACK_OBSERVER_EMAILS, a comma-separated list of people who follow every channel. */
async function findObservers(slack: SlackClient): Promise<string[]> {
	const emails = (process.env.SLACK_OBSERVER_EMAILS ?? "")
		.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
	const ids = [];
	for (const email of emails) {
		const id = await slack.findUserIdByEmail(email);
		if (id) ids.push(id);
		else console.warn(`No Slack user for observer ${email}`);
	}
	return ids;
}

/** Done once the feedback form has gone out, or three days after the event without one. */
function isFinished(event: ChannelEvent, feedbackSent: boolean, now: number): boolean {
	return (
		now >= channelArchiveDeadline(event.eventStart) || (feedbackSent && now >= event.eventStart)
	);
}

async function syncChannel(
	ctx: ActionCtx,
	slack: SlackClient,
	channel: ActiveChannel,
	now: number,
	observers: () => Promise<string[]>,
): Promise<void> {
	const record = (progress: {
		sentReminders?: string[];
		invitedUserIds?: Id<"users">[];
		reportedMissingUserIds?: Id<"users">[];
		archived?: boolean;
	}) =>
		ctx.runMutation(internal.slack.channels.recordProgress, {
			channelId: channel._id,
			...progress,
		});

	const { event } = channel;
	if (!event || isFinished(event, channel.feedbackSent, now)) {
		if (!channel.sentReminders.includes("goodbye")) {
			await slack.postMessage(channel.channelId, ARCHIVE_MESSAGE);
			await record({ sentReminders: ["goodbye"] });
		}
		await slack.archive(channel.channelId);
		await record({ archived: true });
		return;
	}

	if (!channel.sentReminders.includes("welcome")) {
		await slack.postMessage(channel.channelId, welcomeMessage(event));
		await record({ sentReminders: ["welcome"] });
	}

	// Observers join silently, once per channel.
	if (!channel.sentReminders.includes("observers")) {
		const observerIds = await observers();
		if (observerIds.length > 0) {
			await slack.invite(channel.channelId, observerIds);
			await record({ sentReminders: ["observers"] });
		}
	}

	const added = [];
	const reported: Id<"users">[] = [];
	for (const organizer of channel.organizers) {
		if (channel.invitedUserIds.includes(organizer.userId)) continue;
		const slackUserId = await slack.findUserIdByEmail(organizer.email);
		if (slackUserId) added.push({ ...organizer, slackUserId });
		else if (!channel.reportedMissingUserIds.includes(organizer.userId)) {
			await slack.postMessage(channel.channelId, missingMemberMessage(organizer));
			reported.push(organizer.userId);
		}
	}
	if (added.length > 0) {
		await slack.invite(
			channel.channelId,
			added.map(({ slackUserId }) => slackUserId),
		);
		await slack.postMessage(channel.channelId, membersMessage(added));
	}
	if (added.length > 0 || reported.length > 0)
		await record({
			invitedUserIds: added.map(({ userId }) => userId),
			reportedMissingUserIds: reported,
		});

	const { post, handled } = dueReminders(event, now, channel.sentReminders);
	if (post) {
		const tagged = [];
		for (const organizer of channel.organizers) {
			if (organizer.role !== "hovedansvarlig") continue;
			const slackUserId = await slack.findUserIdByEmail(organizer.email);
			if (slackUserId) tagged.push(slackUserId);
		}
		await slack.postMessage(channel.channelId, reminderMessage(post.text(event), tagged));
	}
	if (handled.length > 0) await record({ sentReminders: handled });
}

/** Reconciles Slack with Bifrost: creates, fills, reminds and archives bedpres channels. */
export const syncBedpresChannels = internalAction({
	args: {},
	handler: async (ctx): Promise<void> => {
		if (!featureFlags.slackBot.enabled) return;
		const token = process.env.SLACK_BOT_TOKEN;
		if (!token) {
			console.warn("SLACK_BOT_TOKEN is not set; skipping bedpres channel sync.");
			return;
		}
		const slack = slackClient(token);
		const now = Date.now();
		let observerIds: Promise<string[]> | undefined;
		const observers = () => {
			observerIds ??= findObservers(slack);
			return observerIds;
		};
		const failures: string[] = [];
		// One broken event must not block the others; failures are retried next run.
		const attempt = async (label: string, work: () => Promise<void>) => {
			try {
				await work();
			} catch (error) {
				console.error(label, error);
				failures.push(`${label}: ${(error as Error).message}`);
			}
		};

		const candidates = await ctx.runQuery(internal.slack.channels.eventsNeedingChannels, { now });
		for (const event of candidates.filter(({ eventStart }) => channelOpensAt(eventStart) <= now))
			await attempt(`create channel for ${event.eventId}`, () => createChannel(ctx, slack, event));

		const channels = await ctx.runQuery(internal.slack.channels.activeChannels, {});
		for (const channel of channels)
			await attempt(`sync channel ${channel.channelId}`, async () => {
				try {
					await syncChannel(ctx, slack, channel, now, observers);
				} catch (error) {
					if (!(error instanceof SlackApiError && ARCHIVED_CODES.includes(error.code))) throw error;
					// Someone archived the channel by hand in Slack, so there is nothing left to do.
					await ctx.runMutation(internal.slack.channels.recordProgress, {
						channelId: channel._id,
						archived: true,
					});
				}
			});

		if (failures.length > 0) throw new Error(`Slack sync failed:\n${failures.join("\n")}`);
	},
});
