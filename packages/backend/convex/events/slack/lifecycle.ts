import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { type ActionCtx, internalAction } from "../../_generated/server";
import { slackConfig } from "../../iam/config";
import { slackClient } from "../../iam/slack";

import { lifecycleEnabled } from "./config";

async function reconcileChannel(ctx: ActionCtx, channelId: Id<"companySemesterSlackChannels">) {
	const config = slackConfig();
	if (!config || !lifecycleEnabled()) return;
	const token = crypto.randomUUID();
	const channel = await ctx.runMutation(internal.events.slack.state.claim, { channelId, token });
	if (!channel) return;
	const progress = (fields: {
		slackChannelId?: string;
		archived?: boolean;
		release?: boolean;
		error?: string;
		succeeded?: boolean;
		notificationId?: Id<"eventSlackNotifications">;
	}) => ctx.runMutation(internal.events.slack.state.progress, { channelId, token, ...fields });
	try {
		const context = await ctx.runMutation(internal.events.slack.state.context, {
			channelId,
			now: Date.now(),
		});
		if (!context) return;
		const slack = slackClient(config);
		if (
			context.archive &&
			(!channel.slackChannelId || (channel.archived && context.messages.length === 0))
		)
			return;
		const owner = `Yggdrasil company semester ${channelId}`;
		const slackChannelId =
			channel.slackChannelId ?? (await slack.ensurePrivateChannel(`ygg-${channelId}`, owner));
		await progress({ slackChannelId });
		// Also recovers channels archived manually while there is still work to do.
		if (!context.archive || context.messages.length > 0 || !channel.archived) {
			await slack.setArchived(slackChannelId, false);
			await slack.setChannelPurpose(slackChannelId, owner);
			await slack.renameChannel(slackChannelId, channel.name);
			await slack.reconcileChannelMembers(slackChannelId, context.members);
			await progress({ archived: false });
			for (const queued of context.messages) {
				if (!lifecycleEnabled()) return;
				const message = await ctx.runMutation(internal.events.slack.state.notification, {
					channelId,
					notificationId: queued.id,
					now: Date.now(),
				});
				if (!message) continue;
				// Slack and Convex cannot commit atomically. Look up the stable id before retrying.
				const clientMsgId = `event-${message.id}`;
				if (!(await slack.hasMessage(slackChannelId, clientMsgId)))
					await slack.postMessage(slackChannelId, message.text, clientMsgId, true);
				await progress({ notificationId: message.id });
			}
		}
		if (
			context.archive &&
			(await ctx.runMutation(internal.events.slack.state.context, { channelId, now: Date.now() }))
				?.archive
		) {
			if (!channel.archived) {
				const archiveMessageId = `archive-${channelId}`;
				if (!(await slack.hasMessage(slackChannelId, archiveMessageId)))
					await slack.postMessage(
						slackChannelId,
						"Takk for innsatsen, folkens! Alle arrangementene med bedriften og rapportoppfølgingen er ferdige, så jeg arkiverer kanalen nå. 🙌",
						archiveMessageId,
						true,
					);
			}
			await slack.setArchived(slackChannelId, true);
			await progress({ archived: true });
		}
		await progress({ succeeded: true });
	} catch (error) {
		await progress({ error: error instanceof Error ? error.message : "Slack operation failed" });
		throw error;
	} finally {
		await progress({ release: true });
	}
}

/** Creates shared company channels, reconciles their access, delivers event notices and archives completed work. */
export const reconcile = internalAction({
	args: {},
	handler: async (ctx): Promise<void> => {
		if (!lifecycleEnabled()) return;
		const now = Date.now();
		const failures: unknown[] = [];
		let cursor: string | null = null;
		do {
			const page: { isDone: boolean; continueCursor: string } = await ctx.runMutation(
				internal.events.slack.state.discover,
				{ now, paginationOpts: { cursor, numItems: 50 } },
			);
			cursor = page.isDone ? null : page.continueCursor;
		} while (cursor);
		cursor = null;
		do {
			const page: {
				page: Doc<"companySemesterSlackChannels">[];
				isDone: boolean;
				continueCursor: string;
			} = await ctx.runQuery(internal.events.slack.state.listChannels, {
				paginationOpts: { cursor, numItems: 50 },
			});
			for (const channel of page.page) {
				try {
					await reconcileChannel(ctx, channel._id);
				} catch (error) {
					console.error(`Slack lifecycle failed for ${channel._id}`, error);
					failures.push(error);
				}
			}
			cursor = page.isDone ? null : page.continueCursor;
		} while (cursor);
		if (failures.length)
			throw new Error(`${failures.length} Slack channels failed to reconcile; see function logs.`);
	},
});

export const reconcileOne = internalAction({
	args: { channelId: v.id("companySemesterSlackChannels") },
	handler: async (ctx, { channelId }): Promise<void> => reconcileChannel(ctx, channelId),
});
