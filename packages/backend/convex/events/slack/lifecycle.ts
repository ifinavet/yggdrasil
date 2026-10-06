import { SLACK_CHANNEL_URL } from "@workspace/shared/constants";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { eventSemesterOf } from "@workspace/shared/time";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { type ActionCtx, internalAction } from "../../_generated/server";
import { slackConfig } from "../../iam/config";
import { slackClient } from "../../iam/slack";
import { lifecycleEnabled } from "./config";
import { escapeSlack } from "./messages";

type Channel = Doc<"companySemesterSlackChannels">;
type Slack = ReturnType<typeof slackClient>;
type Context = NonNullable<FunctionReturnType<typeof internal.events.slack.state.context>>;
type Progress = (
	fields: Omit<FunctionArgs<typeof internal.events.slack.state.progress>, "channelId" | "token">,
) => Promise<unknown>;

async function announceCreation(
	slack: Slack,
	channel: Channel,
	slackChannelId: string,
	name: string,
	companyName: string,
	progress: Progress,
) {
	if (channel.creationNoticeChannelId === slackChannelId) return;
	try {
		const key = `company-channel-created-${slackChannelId}`;
		const { semester, year } = eventSemesterOf(channel.semesterStart);
		const exists = await slack.hasMessage(SYSTEM_ALERTS_CHANNEL, key, channel._creationTime);
		if (!exists)
			await slack.postMessage(
				SYSTEM_ALERTS_CHANNEL,
				`Opprettet #${escapeSlack(name)} for ${escapeSlack(companyName)} (${semester} ${year}). 👋 <${SLACK_CHANNEL_URL}${slackChannelId}|Åpne kanal>`,
				key,
				true,
			);
		await progress({ creationNoticeChannelId: slackChannelId });
	} catch (error) {
		// A central-channel outage must not hold up the organizers. Retry on the next reconciliation.
		console.error(`Could not announce creation of ${slackChannelId}`, error);
	}
}

async function deliverNotifications(
	ctx: ActionCtx,
	slack: Slack,
	channelId: Channel["_id"],
	slackChannelId: string,
	messages: Context["messages"],
	progress: Progress,
) {
	// Each failure belongs to its message; keep delivering the rest of the queue.
	let failed = false;
	for await (const queued of messages) {
		if (!lifecycleEnabled()) return;
		try {
			const message = await ctx.runMutation(internal.events.slack.state.notification, {
				channelId,
				notificationId: queued.id,
				now: Date.now(),
			});
			if (!message) continue;
			await progress({});
			const key = `event-${message.id}`;
			if (!(await slack.hasMessage(slackChannelId, key, message.createdAt)))
				await slack.postMessage(slackChannelId, message.text, key, true);
			await progress({ notificationId: message.id });
		} catch (error) {
			failed = true;
			await progress({
				notificationId: queued.id,
				notificationError: error instanceof Error ? error.message : "Slack message failed",
			});
		}
	}
	if (failed) throw new Error("Some Slack messages failed; other messages were still attempted.");
}

async function archiveFinishedChannel(
	ctx: ActionCtx,
	slack: Slack,
	channel: Channel,
	slackChannelId: string,
	progress: Progress,
) {
	const current = await ctx.runMutation(internal.events.slack.state.context, {
		channelId: channel._id,
		now: Date.now(),
	});
	if (!current?.archive || !lifecycleEnabled()) return;
	if (current.messages.length) return;
	const key = `archive-${channel._id}-${channel.generation ?? 1}`;
	if (!(await slack.hasMessage(slackChannelId, key, current.finishedAt ?? channel._creationTime)))
		await slack.postMessage(
			slackChannelId,
			"Takk for innsatsen, folkens! Alle arrangementene med bedriften og rapportoppfølgingen er ferdige, så jeg arkiverer kanalen nå. 🙌",
			key,
			true,
		);
	await slack.archiveChannel(slackChannelId);
	await progress({ archived: true });
}

function desiredChannelName(channel: Channel) {
	const generation = channel.generation ?? 1;
	return generation === 1 ? channel.name : `${channel.name.slice(0, 75)}-${generation}`;
}

async function updateChannel(
	ctx: ActionCtx,
	slack: Slack,
	initial: Channel,
	token: string,
	progress: Progress,
) {
	let channel = initial;
	let context = await ctx.runMutation(internal.events.slack.state.context, {
		channelId: channel._id,
		now: Date.now(),
	});
	if (!context || (context.archive && !channel.slackChannelId)) return;
	if (channel.archived && (context.archive || !context.actionable)) return;
	let info = channel.slackChannelId ? await slack.channelInfo(channel.slackChannelId) : null;
	if (info?.is_archived) {
		if (context.archive || !context.actionable) {
			await progress({ archived: true });
			return;
		}
		// Slack bot tokens cannot unarchive. Keep the old history and reserve one replacement.
		channel = await ctx.runMutation(internal.events.slack.state.replaceArchivedChannel, {
			channelId: channel._id,
			token,
		});
		context = await ctx.runMutation(internal.events.slack.state.context, {
			channelId: channel._id,
			now: Date.now(),
		});
		if (!context) return;
		info = null;
	}
	const generation = channel.generation ?? 1;
	const { semester, year } = eventSemesterOf(channel.semesterStart);
	const purpose = `Arrangementer med ${context.companyName}, ${semester} ${year}`;
	const name = desiredChannelName(channel);
	const slackChannelId =
		channel.slackChannelId ??
		(await slack.ensurePrivateChannel(name, purpose, `${name.slice(0, 45)}-${channel._id}`));
	await progress({ slackChannelId });
	let maintenanceError: unknown;
	try {
		if (info?.purpose?.value !== purpose) await slack.setChannelPurpose(slackChannelId, purpose);
		info ??= await slack.channelInfo(slackChannelId);
		// Migrate temporary names left by the old creator, never rename an established channel.
		const actualName =
			info.name === `ygg-${channel._id}-${generation}`
				? await slack.renameChannel(slackChannelId, name)
				: info.name;
		await announceCreation(
			slack,
			channel,
			slackChannelId,
			actualName,
			context.companyName,
			progress,
		);
		await slack.reconcileChannelMembers(
			slackChannelId,
			context.members,
			channel.managedSlackUserIds ?? [],
			(managedSlackUserIds) => progress({ managedSlackUserIds }),
		);
	} catch (error) {
		maintenanceError = error;
	}
	await progress({ archived: false });
	await deliverNotifications(ctx, slack, channel._id, slackChannelId, context.messages, progress);
	if (maintenanceError) throw maintenanceError;
	if (context.archive) await archiveFinishedChannel(ctx, slack, channel, slackChannelId, progress);
}

async function reconcileChannel(ctx: ActionCtx, channelId: Channel["_id"]) {
	const config = slackConfig();
	if (!config || !lifecycleEnabled()) return;
	const token = crypto.randomUUID();
	const channel = await ctx.runMutation(internal.events.slack.state.claim, { channelId, token });
	if (!channel) return;
	const progress: Progress = (fields) =>
		ctx.runMutation(internal.events.slack.state.progress, { channelId, token, ...fields });
	try {
		await updateChannel(ctx, slackClient(config), channel, token, progress);
		await progress({ succeeded: true });
	} catch (error) {
		await progress({ error: error instanceof Error ? error.message : "Slack operation failed" });
		throw error;
	} finally {
		await progress({ release: true });
	}
}

async function discoverPages(
	ctx: ActionCtx,
	now: number,
	cursor: string | null = null,
): Promise<void> {
	const page: { isDone: boolean; continueCursor: string } = await ctx.runMutation(
		internal.events.slack.state.discover,
		{ now, paginationOpts: { cursor, numItems: 50 } },
	);
	if (!page.isDone) await discoverPages(ctx, now, page.continueCursor);
}
async function reconcilePages(
	ctx: ActionCtx,
	failures: unknown[],
	cursor: string | null = null,
): Promise<void> {
	const page: { page: Channel[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(
		internal.events.slack.state.listChannels,
		{ paginationOpts: { cursor, numItems: 50 } },
	);
	await page.page.reduce(async (previous, channel) => {
		await previous;
		try {
			await reconcileChannel(ctx, channel._id);
		} catch (error) {
			console.error(`Slack lifecycle failed for ${channel._id}`, error);
			failures.push(error);
		}
	}, Promise.resolve());
	if (!page.isDone) await reconcilePages(ctx, failures, page.continueCursor);
}

/** Creates shared channels, reconciles organizer access, sends event notices and archives completed work. */
export const reconcile = internalAction({
	args: {},
	handler: async (ctx): Promise<void> => {
		if (!lifecycleEnabled()) return;
		await discoverPages(ctx, Date.now());
		const failures: unknown[] = [];
		await reconcilePages(ctx, failures);
		if (failures.length)
			throw new Error(`${failures.length} Slack channels failed to reconcile; see function logs.`);
	},
});
