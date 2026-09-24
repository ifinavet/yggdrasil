import { feedbackTokenSchema } from "@workspace/shared/feedback";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx, query } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { isLocalDevelopment } from "../../auth/local";
import { hashLinkToken } from "../../lib/tokens";
import { selectedVersion } from "../delivery/campaigns";
import { feedbackEmailContext } from "../delivery/emailContext";
import { feedbackResend, feedbackSender } from "../delivery/messages";

const maxRegistrants = 500;
const invitationRound = 0;
const recipientArgs = { eventId: v.id("events"), userId: v.id("users") };

const fullName = (user: Doc<"users">) => `${user.firstName} ${user.lastName}`;

function isCollectingFeedback(event: Doc<"events">, campaign: Doc<"feedbackCampaigns">) {
	return (
		event.feedbackEnabled === true &&
		event.published &&
		!event.externalEvent &&
		(campaign.status === "scheduled" || campaign.status === "open") &&
		Date.now() < campaign.closesAt
	);
}

async function manualSendContext(
	ctx: QueryCtx,
	{ eventId, userId }: { eventId: Id<"events">; userId: Id<"users"> },
) {
	const sender = await requireRole(ctx, internalRoles);
	const event = await ctx.db.get(eventId);
	if (!event) throw new ConvexError("Fant ikke arrangementet.");
	const campaign = await ctx.db
		.query("feedbackCampaigns")
		.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
		.order("desc")
		.first();
	if (!campaign || !isCollectingFeedback(event, campaign))
		throw new ConvexError("Arrangementet har ingen aktiv innsamling av tilbakemeldinger.");
	const [registration, recipient, existingInvite] = await Promise.all([
		ctx.db
			.query("registrations")
			.withIndex("by_eventId_and_userId", (index) =>
				index.eq("eventId", eventId).eq("userId", userId),
			)
			.first(),
		ctx.db.get(userId),
		ctx.db
			.query("feedbackInvites")
			.withIndex("by_campaignId_and_userId", (index) =>
				index.eq("campaignId", campaign._id).eq("userId", userId),
			)
			.unique(),
	]);
	if (registration?.status !== "registered" || !recipient)
		throw new ConvexError("Deltakeren er ikke påmeldt arrangementet.");
	if (existingInvite) throw new ConvexError("Deltakeren har allerede fått skjemaet.");
	const formVersionId = campaign.formVersionId ?? (await selectedVersion(ctx, event))?._id;
	if (!formVersionId) throw new ConvexError("Velg et publisert skjema.");
	const email = await feedbackEmailContext(ctx, event);
	if (!email) throw new ConvexError("Fant ikke bedriften.");
	return { sender, campaign, registration, recipient, formVersionId, email };
}

export const listRegistrants = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (index) =>
				index.eq("eventId", eventId).eq("status", "registered"),
			)
			.take(maxRegistrants);
		const users = await Promise.all(registrations.map(({ userId }) => ctx.db.get(userId)));
		return users
			.filter((user) => user !== null)
			.map((user) => ({ userId: user._id, name: fullName(user), email: user.email }));
	},
});

export const prepare = internalQuery({
	args: recipientArgs,
	handler: async (ctx, args) => (await manualSendContext(ctx, args)).email,
});

export const enqueue = internalMutation({
	args: {
		...recipientArgs,
		token: v.string(),
		url: v.string(),
		subject: v.string(),
		html: v.string(),
	},
	handler: async (ctx, args): Promise<string> => {
		const context = await manualSendContext(ctx, args);
		const token = feedbackTokenSchema.parse(args.token);
		const inviteId = await ctx.db.insert("feedbackInvites", {
			campaignId: context.campaign._id,
			userId: context.recipient._id,
			registrationId: context.registration._id,
			responded: false,
			bounced: false,
			complained: false,
			sent: false,
			delivered: false,
			sentBy: context.sender._id,
			formVersionId: context.formVersionId,
		});
		const key = `feedback-manual:${inviteId}`;
		const emailId = isLocalDevelopment()
			? `local:${key}`
			: await feedbackResend.sendEmail(ctx, {
					...feedbackSender,
					to: context.recipient.email,
					subject: args.subject,
					html: args.html,
					idempotencyKey: key,
				});
		const deliveryId = await ctx.db.insert("feedbackDeliveries", {
			campaignId: context.campaign._id,
			inviteId,
			round: invitationRound,
			emailId,
			queuedAt: Date.now(),
		});
		await ctx.db.insert("feedbackTokens", {
			inviteId,
			deliveryId,
			tokenHash: await hashLinkToken(token),
		});
		if (isLocalDevelopment())
			await ctx.db.insert("feedbackLocalEmails", {
				deliveryId,
				to: context.recipient.email,
				subject: args.subject,
				html: args.html,
				url: args.url,
			});
		return fullName(context.recipient);
	},
});
