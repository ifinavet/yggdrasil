import { MINUTE_MS } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	type ActionCtx,
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
} from "../_generated/server";
import { stalePlanningNotice } from "../events/planning/lifecycle";
import { slackConfig } from "./config";
import { slackClient } from "./slack";

const messageArgs = {
	channel: v.string(),
	text: v.string(),
	clientMsgId: v.string(),
	since: v.optional(v.number()),
};

type MessageArgs = { channel: string; text: string; clientMsgId: string; since?: number };

/** Persist before scheduling, and keep the same delivery identity across recovery. */
export async function enqueueSystemMessage(ctx: MutationCtx, args: MessageArgs, schedule = true) {
	const existing = await ctx.db
		.query("slackSystemDeliveries")
		.withIndex("by_channel_and_clientMsgId", (q) =>
			q.eq("channel", args.channel).eq("clientMsgId", args.clientMsgId),
		)
		.unique();
	if (existing?.status === "sent") return null;
	if (existing?.status === "cancelled") {
		if (await obsolete(ctx, existing)) return null;
		await ctx.db.patch(existing._id, {
			status: "pending",
			nextAttemptAt: Date.now(),
			text: args.text,
		});
	}
	const id =
		existing?._id ??
		(await ctx.db.insert("slackSystemDeliveries", {
			...args,
			since: args.since ?? Date.now(),
			status: "pending",
			nextAttemptAt: Date.now(),
			attempts: 0,
		}));
	if (schedule && (!existing || existing.status === "cancelled"))
		await ctx.scheduler.runAfter(0, internal.iam.notifications.sendMessage, args);
	return id;
}

export const enqueue = internalMutation({
	args: messageArgs,
	handler: async (ctx, args): Promise<Id<"slackSystemDeliveries"> | null> =>
		enqueueSystemMessage(ctx, args, false),
});

async function obsolete(ctx: MutationCtx, item: Doc<"slackSystemDeliveries">) {
	if (item.clientMsgId.startsWith("planning:")) {
		const [, rawId, ...key] = item.clientMsgId.split(":");
		const id = ctx.db.normalizeId("events", rawId ?? "");
		return !id || (await stalePlanningNotice(ctx, id, `planning:${key.join(":")}`));
	}
	const opening = /^registration-open-([^-]+)-(\d+)$/.exec(item.clientMsgId);
	if (opening) {
		const event = await ctx.db.get(opening[1] as Id<"events">);
		return (
			!event?.published ||
			event.externalEvent ||
			event.eventStart <= Date.now() ||
			event.registrationOpens !== Number(opening[2])
		);
	}
	if (item.clientMsgId.startsWith("feedback-report-")) {
		const report = await ctx.db.get(
			item.clientMsgId.slice("feedback-report-".length) as Id<"feedbackReports">,
		);
		return report?.status !== "draft" || report.totalResponses === 0;
	}
	return false;
}

export const claim = internalMutation({
	args: { id: v.id("slackSystemDeliveries"), token: v.string() },
	handler: async (ctx, { id, token }) => {
		const item = await ctx.db.get(id);
		if (
			item?.status !== "pending" ||
			item.nextAttemptAt > Date.now() ||
			(item.leaseUntil ?? 0) > Date.now()
		)
			return null;
		if (await obsolete(ctx, item)) {
			await ctx.db.patch(id, { status: "cancelled" });
			return null;
		}
		await ctx.db.patch(id, {
			leaseToken: token,
			leaseUntil: Date.now() + 5 * MINUTE_MS,
			attempts: item.attempts + 1,
		});
		return item;
	},
});

export const complete = internalMutation({
	args: { id: v.id("slackSystemDeliveries"), token: v.string(), error: v.optional(v.string()) },
	handler: async (ctx, { id, token, error }) => {
		const item = await ctx.db.get(id);
		if (!item || item.leaseToken !== token) throw new Error("Slack delivery lease expired");
		if (error === undefined) {
			const opening = /^registration-open-([^-]+)-(\d+)$/.exec(item.clientMsgId);
			if (opening) {
				const notice = await ctx.db
					.query("eventRegistrationOpenNotices")
					.withIndex("by_eventId_and_registrationOpens", (q) =>
						q.eq("eventId", opening[1] as Id<"events">).eq("registrationOpens", Number(opening[2])),
					)
					.first();
				if (notice) await ctx.db.patch(notice._id, { sentAt: Date.now() });
			}
		}
		await ctx.db.patch(id, {
			leaseToken: undefined,
			leaseUntil: undefined,
			...(error !== undefined
				? {
						lastError: error,
						nextAttemptAt:
							Date.now() + Math.min(15 * MINUTE_MS, 2 ** Math.min(item.attempts, 4) * MINUTE_MS),
					}
				: { status: "sent" as const, sentAt: Date.now(), lastError: undefined }),
		});
	},
});

export const pending = internalQuery({
	args: { now: v.number() },
	handler: (ctx, { now }) =>
		ctx.db
			.query("slackSystemDeliveries")
			.withIndex("by_status_and_nextAttemptAt", (q) =>
				q.eq("status", "pending").lte("nextAttemptAt", now),
			)
			.take(50),
});

async function deliver(ctx: ActionCtx, id: Id<"slackSystemDeliveries">) {
	const config = slackConfig();
	if (!config) return;
	const token = crypto.randomUUID();
	const item = await ctx.runMutation(internal.iam.notifications.claim, { id, token });
	if (!item) return;
	try {
		const slack = slackClient(config);
		// Check history on retries and when adopting a legacy notice with an earlier timestamp.
		const recover = item.attempts > 0 || item.since < item._creationTime;
		if (!recover || !(await slack.hasMessage(item.channel, item.clientMsgId, item.since)))
			await slack.postMessage(item.channel, item.text, item.clientMsgId, true);
		await ctx.runMutation(internal.iam.notifications.complete, { id, token });
	} catch (error) {
		await ctx.runMutation(internal.iam.notifications.complete, {
			id,
			token,
			error: error instanceof Error ? error.message : "Slack delivery failed",
		});
		throw error;
	}
}

export const sendMessage = internalAction({
	args: { ...messageArgs, attempt: v.optional(v.number()) },
	returns: v.null(),
	handler: async (ctx, { attempt: _legacyAttempt, ...args }): Promise<null> => {
		const id: Id<"slackSystemDeliveries"> | null = await ctx.runMutation(
			internal.iam.notifications.enqueue,
			args,
		);
		if (id) await deliver(ctx, id);
		return null;
	},
});

/** Retry each persisted message independently; one bad message cannot block the batch. */
export const retryPending = internalAction({
	args: {},
	handler: async (ctx): Promise<void> => {
		const items: Doc<"slackSystemDeliveries">[] = await ctx.runQuery(
			internal.iam.notifications.pending,
			{ now: Date.now() },
		);
		await items.reduce(async (previous, item) => {
			await previous;
			try {
				await deliver(ctx, item._id);
			} catch (error) {
				console.error(`Slack message ${item._id} remains pending`, error);
			}
		}, Promise.resolve());
	},
});
