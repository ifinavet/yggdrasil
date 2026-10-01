import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { DAY_MS, REMINDER_DAYS } from "@workspace/shared/time";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { latestCampaign } from "../../feedback/delivery/campaigns";
import { enqueueSystemMessage } from "../../iam/notifications";
import { countRegistrationsWithStatus } from "../helper";
import { REMINDER_KINDS } from "../reminders/schedule";
import {
	escapeSlack,
	eventUrl,
	feedbackSentText,
	registrationFullText,
	reminderSentText,
	reportReadyText,
	reportSentText,
	unregisterWaveText,
} from "./messages";

type Notice = { key: string; text: string };

/** Reconstruct milestones from stored facts, never from an assumption that queued email was sent. */
export async function recoverableNotices(ctx: MutationCtx, event: Doc<"events">, now: number) {
	const notices: Notice[] = [];
	if (event.published && event.eventStart > now) {
		if (
			event.participationLimit > 0 &&
			(await countRegistrationsWithStatus(ctx, event._id, "registered")) >= event.participationLimit
		)
			notices.push({ key: "registration-full", text: registrationFullText });
		if (event.registrationOpens <= now)
			notices.push({
				key: `registration-open:${event.registrationOpens}`,
				text: "Påmeldingen er åpen! 🎉",
			});
		if (event.remindersEnabled) {
			for await (const kind of REMINDER_KINDS) {
				const sent = await ctx.db
					.query("eventReminderDeliveries")
					.withIndex("by_eventId_and_kind_and_userId", (q) =>
						q.eq("eventId", event._id).eq("kind", kind),
					)
					.filter((q) =>
						q.and(q.eq(q.field("sent"), true), q.eq(q.field("eventStart"), event.eventStart)),
					)
					.first();
				if (sent) notices.push({ key: `reminder-sent:${kind}`, text: reminderSentText(kind) });
			}
		}
		const wave = await ctx.db
			.query("engagementAlerts")
			.withIndex("by_eventId_and_rule", (q) =>
				q.eq("eventId", event._id).eq("rule", "unregisterWave"),
			)
			.order("desc")
			.first();
		if (wave && !wave.dismissedAt && wave.triggeredAt >= now - DAY_MS)
			notices.push({
				key: `unregister-wave:${wave.triggeredAt}`,
				text: unregisterWaveText(wave.summary, wave.detail),
			});
	}
	if (!event.feedbackEnabled) return notices;
	const campaign = await latestCampaign(ctx, event._id);
	if (!campaign || campaign.status === "cancelled") return notices;
	for await (const round of [0, ...REMINDER_DAYS]) {
		const sent = await ctx.db
			.query("feedbackDeliveries")
			.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("round"), round),
					q.neq(q.field("outcome"), "failed"),
					q.or(q.neq(q.field("sentAt"), undefined), q.eq(q.field("outcome"), "delivered")),
				),
			)
			.first();
		if (sent)
			notices.push({
				key: `feedback-sent:${campaign._id}:${round}`,
				text: feedbackSentText(round),
			});
	}
	const report = await ctx.db
		.query("feedbackReports")
		.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
		.unique();
	if (report?.status === "draft" && report.totalResponses > 0)
		await enqueueSystemMessage(ctx, {
			channel: SYSTEM_ALERTS_CHANNEL,
			clientMsgId: `feedback-report-${report._id}`,
			since: report.readyAt ?? report._creationTime,
			text: `📊 *Feedbackrapporten er klar til gjennomgang*\n*Arrangement:* ${escapeSlack(event.title)}\n<${eventUrl(event)}/report|Åpne rapporten>`,
		});
	if (report?.status === "draft")
		notices.push({
			key: `report-ready:${report._id}`,
			text: reportReadyText(report.totalResponses),
		});
	if (
		report?.status === "approved" &&
		report.followupFinishedAt !== undefined &&
		report.deliveryStatus !== "failed"
	)
		notices.push({
			key: `report-sent:${report._id}:${report.deliveryAttempt ?? 0}`,
			text: reportSentText,
		});
	return notices;
}
