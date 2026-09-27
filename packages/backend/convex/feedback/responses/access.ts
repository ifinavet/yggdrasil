import { feedbackFieldsSchema, feedbackTokenSchema } from "@workspace/shared/feedback";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { getCurrentUser } from "../../auth/currentUser";
import { hashLinkToken } from "../../lib/tokens";

/** Shared by the read-only resolver and the atomic submission mutation. */
export async function getFeedbackTokenAccess(ctx: QueryCtx, token: string, now: number) {
	if (!feedbackTokenSchema.safeParse(token).success) return { status: "invalid" } as const;
	const tokenHash = await hashLinkToken(token);
	const storedToken = await ctx.db
		.query("feedbackTokens")
		.withIndex("by_tokenHash", (index) => index.eq("tokenHash", tokenHash))
		.unique();
	if (!storedToken) return { status: "invalid" } as const;
	return getFeedbackInviteAccess(ctx, await ctx.db.get(storedToken.inviteId), now);
}

/** The signed-in path: the invite id is only a pointer, ownership is the credential. */
export async function getOwnFeedbackInviteAccess(ctx: QueryCtx, inviteId: string, now: number) {
	const id = ctx.db.normalizeId("feedbackInvites", inviteId);
	const user = await getCurrentUser(ctx);
	const invite = id && (await ctx.db.get(id));
	if (!user || !invite || invite.userId !== user._id) return { status: "invalid" } as const;
	return getFeedbackInviteAccess(ctx, invite, now);
}

export type FeedbackAccess = Awaited<ReturnType<typeof getFeedbackInviteAccess>>;

export async function getFeedbackInviteAccess(
	ctx: QueryCtx,
	invite: Doc<"feedbackInvites"> | null,
	now: number,
) {
	if (!invite || invite.retainedAt !== undefined || !invite.userId)
		return { status: "invalid" } as const;
	const campaign = await ctx.db.get(invite.campaignId);
	if (!campaign || campaign.retainedAt !== undefined) return { status: "invalid" } as const;
	const event = await ctx.db.get(campaign.eventId);
	if (event?.feedbackEnabled !== true) return { status: "unavailable" } as const;
	if (campaign.status === "closed" || campaign.status === "cancelled" || now >= campaign.closesAt)
		return { status: "closed" } as const;
	const opensWithCampaign = invite.sentBy === undefined;
	if (opensWithCampaign && (campaign.status !== "open" || now < campaign.opensAt))
		return { status: "not-open" } as const;
	const previousResponse = await ctx.db
		.query("formResponses")
		.withIndex("by_inviteId", (index) => index.eq("inviteId", invite._id))
		.first();
	if (invite.responded || previousResponse) return { status: "already-submitted" } as const;
	const formVersionId = campaign.formVersionId ?? invite.formVersionId;
	if (!formVersionId) return { status: "invalid" } as const;
	const publishedVersion = await ctx.db.get(formVersionId);
	if (!publishedVersion) return { status: "invalid" } as const;
	const storedFields = await ctx.db
		.query("formFields")
		.withIndex("by_formVersionId_and_order", (index) =>
			index.eq("formVersionId", publishedVersion._id),
		)
		.take(41);
	// Zod strips storage metadata and validates the bounded snapshot.
	const validationResult = feedbackFieldsSchema.safeParse(storedFields);
	if (!validationResult.success) return { status: "invalid" } as const;
	return {
		status: "open",
		invite,
		campaign,
		event,
		publishedVersion,
		fields: validationResult.data,
	} as const;
}

export async function getFeedbackTokenForm(
	ctx: QueryCtx,
	{ token, now }: { token: string; now: number },
) {
	return feedbackForm(await getFeedbackTokenAccess(ctx, token, now));
}

export async function getOwnFeedbackInviteForm(
	ctx: QueryCtx,
	{ inviteId, now }: { inviteId: string; now: number },
) {
	return feedbackForm(await getOwnFeedbackInviteAccess(ctx, inviteId, now));
}

function feedbackForm(access: FeedbackAccess) {
	if (access.status !== "open") return access;
	return {
		status: "open" as const,
		event: { title: access.event.title, eventStart: access.event.eventStart },
		form: { name: access.publishedVersion.name, fields: access.fields },
		closesAt: access.campaign.closesAt,
	};
}
