import { start } from "@convex-dev/workflow";
import {
	feedbackOpensAt,
	feedbackRetentionAt,
	feedbackRoundAt,
} from "@workspace/shared/feedback/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { getLatestPublishedVersion } from "../forms/helpers";

export const campaignArgs = { campaignId: v.id("feedbackCampaigns"), generation: v.number() };

async function selectedVersion(ctx: QueryCtx, event: Doc<"events">) {
	const formId =
		event.feedbackFormId ??
		(
			await ctx.db
				.query("feedbackForms")
				.withIndex("by_isDefault", (index) => index.eq("isDefault", true))
				.unique()
		)?._id;
	return formId ? getLatestPublishedVersion(ctx, formId) : null;
}

async function canScheduleFeedback(
	ctx: QueryCtx,
	event: Doc<"events">,
	opensAt: number,
	requireSchedule: boolean,
) {
	let schedulingError: string | null = null;
	if (opensAt <= Date.now()) {
		schedulingError = "Slå på tilbakemeldinger før utsendelsestidspunktet.";
	} else if (!(await selectedVersion(ctx, event))) {
		schedulingError = "Publiser et skjema før tilbakemeldinger slås på.";
	}
	if (schedulingError && requireSchedule) throw new ConvexError(schedulingError);
	return schedulingError === null;
}

export async function finishCampaign(
	ctx: MutationCtx,
	campaign: Doc<"feedbackCampaigns">,
	status: "closed" | "cancelled",
) {
	const closedAt = Date.now();
	await ctx.db.patch(campaign._id, {
		status,
		closedAt,
		retentionAt: feedbackRetentionAt(closedAt),
	});
	if (status === "closed" && campaign.formVersionId)
		await ctx.scheduler.runAfter(0, internal.feedback.reports.build.prepareClosedReport, {
			campaignId: campaign._id,
		});
	await ctx.scheduler.runAfter(0, internal.feedback.delivery.messages.cancelCampaignEmails, {
		campaignId: campaign._id,
		cursor: null,
	});
}

export async function syncFeedbackCampaign(
	ctx: MutationCtx,
	eventId: Id<"events">,
	{ requireSchedule = false }: { requireSchedule?: boolean } = {},
): Promise<void> {
	const event = await ctx.db.get(eventId);
	if (!event) throw new ConvexError("Arrangementet finnes ikke.");
	const existing = await ctx.db
		.query("feedbackCampaigns")
		.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
		.order("desc")
		.first();
	if (event.feedbackEnabled !== true || !event.published || event.externalEvent) {
		if (existing && (existing.status === "scheduled" || existing.status === "open"))
			await finishCampaign(ctx, existing, "cancelled");
		return;
	}
	// Once invitations exist, changes to the event cannot reset answers or send a second campaign.
	if (existing && existing.status !== "scheduled" && existing.formVersionId) return;
	const opensAt = feedbackOpensAt(event.eventStart);
	if (existing?.status === "scheduled" && existing.opensAt === opensAt) return;
	// Routine event edits must still save when feedback can no longer be scheduled.
	if (!(await canScheduleFeedback(ctx, event, opensAt, requireSchedule))) {
		if (existing?.status === "scheduled") await finishCampaign(ctx, existing, "cancelled");
		return;
	}
	const generation = (existing?.generation ?? 0) + 1;
	const closesAt = feedbackRoundAt(opensAt, 14);
	const schedule = {
		status: "scheduled" as const,
		generation,
		opensAt,
		closesAt,
		closedAt: undefined,
		retentionAt: undefined,
	};
	let campaignId: Id<"feedbackCampaigns">;
	if (existing) {
		campaignId = existing._id;
		await ctx.db.patch(campaignId, schedule);
	} else {
		campaignId = await ctx.db.insert("feedbackCampaigns", { eventId, ...schedule });
	}
	// Old sleeping workflows are harmless: every step checks the campaign generation before writing.
	const workflowId = await start(ctx, internal.feedback.delivery.workflows.campaignV1, {
		campaignId,
		generation,
		opensAt,
		closesAt,
	});
	await ctx.db.patch(campaignId, { workflowId });
}

export const openCampaign = internalMutation({
	args: campaignArgs,
	handler: async (ctx, { campaignId, generation }): Promise<boolean> => {
		const campaign = await ctx.db.get(campaignId);
		if (!campaign || campaign.generation !== generation || campaign.status !== "scheduled")
			return false;
		if (Date.now() < campaign.opensAt) return false;
		if (Date.now() >= campaign.closesAt) {
			await finishCampaign(ctx, campaign, "closed");
			return false;
		}
		const event = await ctx.db.get(campaign.eventId);
		if (event?.feedbackEnabled !== true || !event.published || event.externalEvent) {
			await finishCampaign(ctx, campaign, "cancelled");
			return false;
		}
		const version = await selectedVersion(ctx, event);
		if (!version) {
			await finishCampaign(ctx, campaign, "cancelled");
			await ctx.db.patch(campaignId, {
				failure: "Det valgte skjemaet har ingen publisert versjon.",
			});
			return false;
		}
		await ctx.db.patch(campaignId, { status: "open", formVersionId: version._id });
		await start(ctx, internal.feedback.delivery.workflows.participantsV1, {
			campaignId,
			generation,
		});
		return true;
	},
});

export const closeCampaign = internalMutation({
	args: campaignArgs,
	handler: async (ctx, { campaignId, generation }): Promise<void> => {
		const campaign = await ctx.db.get(campaignId);
		if (
			!campaign ||
			campaign.generation !== generation ||
			campaign.status !== "open" ||
			Date.now() < campaign.closesAt
		)
			return;
		await finishCampaign(ctx, campaign, "closed");
	},
});

export const inviteParticipants = internalMutation({
	args: { ...campaignArgs, cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, { campaignId, generation, cursor }): Promise<string | null> => {
		const campaign = await ctx.db.get(campaignId);
		if (
			!campaign ||
			campaign.generation !== generation ||
			campaign.status !== "open" ||
			Date.now() >= campaign.closesAt
		)
			return null;
		const event = await ctx.db.get(campaign.eventId);
		if (event?.feedbackEnabled !== true || !event.published || event.externalEvent) return null;
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (index) =>
				index.eq("eventId", event._id).eq("status", "registered"),
			)
			.paginate({ numItems: 50, cursor });
		for (const registration of registrations.page) {
			if (registration.attendanceStatus !== "confirmed" && registration.attendanceStatus !== "late")
				continue;
			const organizer = await ctx.db
				.query("eventOrganizers")
				.withIndex("by_eventId_and_userId", (index) =>
					index.eq("eventId", event._id).eq("userId", registration.userId),
				)
				.first();
			if (organizer || !(await ctx.db.get(registration.userId))) continue;
			const existing = await ctx.db
				.query("feedbackInvites")
				.withIndex("by_campaignId_and_userId", (index) =>
					index.eq("campaignId", campaignId).eq("userId", registration.userId),
				)
				.unique();
			if (existing) continue;
			const inviteId = await ctx.db.insert("feedbackInvites", {
				campaignId,
				userId: registration.userId,
				registrationId: registration._id,
				responded: false,
				bounced: false,
				complained: false,
				sent: false,
				delivered: false,
			});
			const workflowId = await start(ctx, internal.feedback.delivery.workflows.invitationV1, {
				inviteId,
				generation,
				opensAt: campaign.opensAt,
			});
			await ctx.db.patch(inviteId, { workflowId });
		}
		return registrations.isDone ? null : registrations.continueCursor;
	},
});
