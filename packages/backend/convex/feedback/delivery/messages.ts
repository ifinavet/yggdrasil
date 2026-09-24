import { type EmailId, Resend, vOnEmailEventArgs } from "@convex-dev/resend";
import { vResultValidator, vWorkflowId } from "@convex-dev/workflow";
import { feedbackTokenSchema } from "@workspace/shared/feedback";
import { feedbackRoundAt } from "@workspace/shared/feedback/time";
import { v } from "convex/values";
import { components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
} from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { hashLinkToken } from "../../lib/tokens";
import { feedbackEmailContext } from "./emailContext";

export const feedbackResend: Resend = new Resend(components.feedbackResend, {
	testMode: false,
	onEmailEvent: internal.feedback.delivery.messages.onEmailEvent,
});
export const FEEDBACK_REPLY_TO = "arrangement@ifinavet.no";
export const feedbackSender = {
	from: "Navet <info@ifinavet.no>",
	replyTo: [FEEDBACK_REPLY_TO],
};
export const deliveryArgs = {
	inviteId: v.id("feedbackInvites"),
	generation: v.number(),
	round: v.union(v.literal(0), v.literal(3), v.literal(7), v.literal(11)),
};

async function deliveryContext(
	ctx: QueryCtx,
	inviteId: Id<"feedbackInvites">,
	generation: number,
	round: number,
	now: number,
) {
	const invite = await ctx.db.get(inviteId);
	if (
		!invite ||
		invite.responded ||
		invite.bounced ||
		invite.complained ||
		!invite.userId ||
		invite.retainedAt !== undefined
	)
		return null;
	const campaign = await ctx.db.get(invite.campaignId);
	if (
		campaign?.status !== "open" ||
		campaign.generation !== generation ||
		!campaign.formVersionId ||
		campaign.retainedAt !== undefined
	)
		return null;
	if (now < feedbackRoundAt(campaign.opensAt, round) || now >= campaign.closesAt) return null;
	const event = await ctx.db.get(campaign.eventId);
	if (!event) return null;
	const response = await ctx.db
		.query("formResponses")
		.withIndex("by_inviteId", (index) => index.eq("inviteId", inviteId))
		.first();
	if (response) return null;
	const user = await ctx.db.get(invite.userId);
	if (!user) return null;
	return { invite, campaign, event, user };
}

export const prepareEmail = internalQuery({
	args: { ...deliveryArgs, now: v.number() },
	handler: async (ctx, { inviteId, generation, round, now }) => {
		const context = await deliveryContext(ctx, inviteId, generation, round, now);
		return context ? feedbackEmailContext(ctx, context.event) : null;
	},
});

export const enqueueEmail = internalMutation({
	args: {
		...deliveryArgs,
		token: v.string(),
		url: v.string(),
		subject: v.string(),
		html: v.string(),
	},
	handler: async (ctx, args): Promise<string | null> => {
		// Rendering runs in an action. Recheck eligibility here so a response or flag change during rendering wins.
		const context = await deliveryContext(
			ctx,
			args.inviteId,
			args.generation,
			args.round,
			Date.now(),
		);
		if (!context) return null;
		const existing = await ctx.db
			.query("feedbackDeliveries")
			.withIndex("by_inviteId_and_round", (index) =>
				index.eq("inviteId", args.inviteId).eq("round", args.round),
			)
			.unique();
		if (existing) return existing.emailId;
		const token = feedbackTokenSchema.parse(args.token);
		const key = `feedback:${args.inviteId}:${args.round}`;
		const emailId = isLocalDevelopment()
			? `local:${key}`
			: await feedbackResend.sendEmail(ctx, {
					...feedbackSender,
					to: context.user.email,
					subject: args.subject,
					html: args.html,
					idempotencyKey: key,
				});
		const deliveryId = await ctx.db.insert("feedbackDeliveries", {
			campaignId: context.campaign._id,
			inviteId: args.inviteId,
			round: args.round,
			emailId,
			queuedAt: Date.now(),
		});
		await ctx.db.insert("feedbackTokens", {
			inviteId: args.inviteId,
			deliveryId,
			tokenHash: await hashLinkToken(token),
		});
		if (isLocalDevelopment())
			await ctx.db.insert("feedbackLocalEmails", {
				deliveryId,
				to: context.user.email,
				subject: args.subject,
				html: args.html,
				url: args.url,
			});
		return emailId;
	},
});

export async function cancelInvitationEmails(ctx: MutationCtx, inviteId: Id<"feedbackInvites">) {
	const deliveries = await ctx.db
		.query("feedbackDeliveries")
		.withIndex("by_inviteId_and_round", (index) => index.eq("inviteId", inviteId))
		.take(4);
	for (const delivery of deliveries) {
		if (delivery.emailId.startsWith("local:")) continue;
		const emailId = delivery.emailId as EmailId;
		const status = await feedbackResend.status(ctx, emailId);
		if (status && (status.status === "waiting" || status.status === "queued"))
			await feedbackResend.cancelEmail(ctx, emailId);
	}
}

export const cancelCampaignEmails = internalMutation({
	args: { campaignId: v.id("feedbackCampaigns"), cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, args): Promise<void> => {
		const invites = await ctx.db
			.query("feedbackInvites")
			.withIndex("by_campaignId", (index) => index.eq("campaignId", args.campaignId))
			.paginate({ numItems: 25, cursor: args.cursor });
		for (const invite of invites.page) await cancelInvitationEmails(ctx, invite._id);
		if (!invites.isDone)
			await ctx.scheduler.runAfter(0, internal.feedback.delivery.messages.cancelCampaignEmails, {
				...args,
				cursor: invites.continueCursor,
			});
	},
});

const deliveryOutcomes = {
	"email.delivered": "delivered",
	"email.bounced": "failed",
	"email.complained": "failed",
	"email.failed": "failed",
} as const;

export const onInvitationComplete = internalMutation({
	args: {
		workflowId: vWorkflowId,
		result: vResultValidator,
		context: v.object({ inviteId: v.id("feedbackInvites") }),
	},
	handler: async (ctx, { result, context }): Promise<void> => {
		if (result.kind !== "failed") return;
		const invite = await ctx.db.get(context.inviteId);
		if (invite) await ctx.db.patch(invite._id, { failure: result.error });
	},
});

export const onEmailEvent = internalMutation({
	args: vOnEmailEventArgs,
	handler: async (ctx, { id, event }): Promise<void> => {
		const delivery = await ctx.db
			.query("feedbackDeliveries")
			.withIndex("by_emailId", (index) => index.eq("emailId", id))
			.unique();
		if (!delivery) {
			const report = await ctx.db
				.query("feedbackReports")
				.withIndex("by_emailId", (index) => index.eq("emailId", id))
				.unique();
			if (report?.status === "approved") {
				if (event.type === "email.delivered" && report.deliveryStatus !== "failed")
					await ctx.db.patch(report._id, { deliveryStatus: "delivered" });
				if (
					event.type === "email.bounced" ||
					event.type === "email.complained" ||
					event.type === "email.failed"
				)
					await ctx.db.patch(report._id, { deliveryStatus: "failed" });
			}
			return;
		}
		const outcome = deliveryOutcomes[event.type as keyof typeof deliveryOutcomes];
		await ctx.db.patch(delivery._id, {
			callbackAt: Date.now(),
			...(outcome && delivery.outcome !== "failed" && { outcome }),
		});
		const invite = await ctx.db.get(delivery.inviteId);
		if (!invite) return;
		const statusFields = {
			"email.sent": "sent",
			"email.delivered": "delivered",
			"email.bounced": "bounced",
			"email.complained": "complained",
		} as const;
		const field = statusFields[event.type as keyof typeof statusFields];
		if (!field || invite[field]) return;
		// Delivery callbacks can be repeated or arrive out of order. These flags only move to true.
		await ctx.db.patch(invite._id, { [field]: true });
		if (field === "bounced" || field === "complained")
			await cancelInvitationEmails(ctx, invite._id);
	},
});
