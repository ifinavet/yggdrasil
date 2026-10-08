import { EVENT_CHECKLIST, hasEventText } from "@workspace/shared/events/checklist";
import {
	EVENT_PLANNING,
	eventPlanningAt,
	feedbackOpensAt,
	feedbackRoundAt,
	HOUR_MS,
} from "@workspace/shared/time";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { latestCampaign } from "../../feedback/delivery/campaigns";
import { eventUrl, timedOrganizerReminders } from "./messages";

type Reminder = { key: string; at: number; text: string };
const due = (at: number, now: number, until: number) => now >= at && now < until;

function promotionReminders(event: Doc<"events">, now: number): Reminder[] {
	const missing = (["title", "teaser", "description"] as const)
		.filter((field) => !hasEventText(event[field]))
		.map((field) => ({ title: "tittel", teaser: "teaser", description: "beskrivelse" })[field]);
	const at = eventPlanningAt(event.eventStart, EVENT_PLANNING.textDaysBefore);
	if (due(at, now, event.eventStart) && missing.length)
		return [
			{
				key: "missing-text",
				at,
				text: `${missing.join(", ")} mangler fortsatt ordentlig innhold. Dette må dere få på plass nå, så vi rekker å promotere arrangementet. <${eventUrl(event)}|Oppdater arrangementet>.`,
			},
		];
	const promotionAt = eventPlanningAt(event.registrationOpens, EVENT_PLANNING.promotionDaysBefore);
	if (
		!due(promotionAt, now, event.registrationOpens) ||
		event.completedChecklistSteps?.includes("promotion")
	)
		return [];
	const missingCopy = missing.length
		? ` ${missing.join(", ")} mangler fortsatt ordentlig innhold. <${eventUrl(event)}|Oppdater arrangementet>.`
		: "";
	return [
		{
			key: `promotion:${event.registrationOpens}`,
			at: promotionAt,
			text: `Påmeldingen åpner snart. Avklar promotering med PR-ansvarlig, så folk får det med seg. 📣${missingCopy}`,
		},
	];
}

function checklistReminder(event: Doc<"events">, now: number): Reminder[] {
	const at = eventPlanningAt(event.eventStart, EVENT_PLANNING.checklistDaysBefore);
	if (!due(at, now, event.eventStart)) return [];
	const unfinished = EVENT_CHECKLIST.flatMap((phase) => [...phase.steps]).filter(
		(step) =>
			["room", "food", "helpers"].includes(step.id) &&
			!event.completedChecklistSteps?.includes(step.id),
	);
	if (!unfinished.length) return [];
	return [
		{
			key: "unfinished-checklist",
			at,
			text: `Disse punktene står fortsatt åpne i sjekklisten: ${unfinished.map((step) => step.label.toLocaleLowerCase("nb")).join(", ")}. Kan dere få dem på plass?`,
		},
	];
}

function attendanceSchedule(opensAt: number) {
	return [
		...EVENT_PLANNING.attendanceHoursAfterFeedback.map((hours) => opensAt + hours * HOUR_MS),
		...EVENT_PLANNING.attendanceDaysAfterFeedback.map((days) => feedbackRoundAt(opensAt, days)),
	];
}

async function attendanceReminder(
	ctx: QueryCtx,
	event: Doc<"events">,
	campaign: Doc<"feedbackCampaigns"> | null,
	now: number,
): Promise<Reminder[]> {
	const opensAt = campaign?.opensAt ?? feedbackOpensAt(event.eventStart);
	const schedule = attendanceSchedule(opensAt);
	const closesAt = campaign?.closesAt ?? Number.POSITIVE_INFINITY;
	const index = schedule.filter((at) => at <= now).length - 1;
	const at = schedule[index];
	// There is no event end field, so every warning waits until after the event start.
	if (
		at === undefined ||
		now <= event.eventStart ||
		now >= (at < opensAt ? opensAt : (schedule[index + 1] ?? closesAt)) ||
		campaign?.status === "cancelled" ||
		campaign?.status === "closed" ||
		(at >= opensAt && campaign?.status !== "open")
	)
		return [];
	let missing = 0;
	for await (const registration of ctx.db
		.query("registrations")
		.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
			q.eq("eventId", event._id).eq("status", "registered"),
		)) {
		if (!registration.attendanceStatus) missing++;
	}
	if (!missing) return [];
	const link = `<${eventUrl(event)}/registrations|Registrer oppmøtet>, og gi "Ikke møtt" til dem som ikke kom.`;
	if (index === 0)
		return [
			{
				key: "missing-attendance",
				at,
				text: `🚨 Dere har ikke registrert oppmøte for ${missing} påmeldte! Skjemaet går ut om en time, og bare til dem som er registrert som møtt. ${link}`,
			},
		];
	const still = `🚨🚨 Oppmøtet for ${missing} påmeldte er FORTSATT ikke registrert! De får ikke skjemaet før dere fikser det, så fiks det nå. ${link}`;
	const text =
		index === schedule.length - 1
			? `🤖🚨 Nå er det nok. ${missing} påmeldte mangler fortsatt oppmøte. Jeg har startet 3D-printeren på Sonen og printer meg en robotkropp, og så kommer jeg og finner deg på IFI hvis du ikke fikser dette ASAP. ${link}`
			: index === schedule.length - 2
				? `😠😠😠 Siste påminnelse! ${missing} påmeldte mangler fortsatt oppmøte, og de får ikke skjemaet før dere registrerer det. Kom igjen! ${link}`
				: still;
	return [{ key: `missing-attendance:followup-${index}`, at, text }];
}

async function approvalReminder(
	ctx: QueryCtx,
	event: Doc<"events">,
	campaign: Doc<"feedbackCampaigns"> | null,
	now: number,
): Promise<Reminder[]> {
	if (!campaign) return [];
	const report = await ctx.db
		.query("feedbackReports")
		.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
		.unique();
	if (report?.status !== "draft" || report.totalResponses === 0) return [];
	const at = eventPlanningAt(
		report.readyAt ?? report._creationTime,
		-EVENT_PLANNING.approvalDaysAfter,
	);
	if (now < at) return [];
	return [
		{
			key: `report-approval:${report._id}`,
			at,
			text: `En liten påminnelse: Rapporten venter fortsatt på gjennomgang. <${eventUrl(event)}/report|Se gjennom og godkjenn den>, så kan jeg sende den til bedriften. 😊`,
		},
	];
}

/** All conditional notices are recalculated both when queued and immediately before sending. */
export async function dueOrganizerReminders(ctx: QueryCtx, event: Doc<"events">, now: number) {
	const reminders = [
		...timedOrganizerReminders(event).filter((item) =>
			due(
				item.at,
				now,
				item.key === "expenses" ? eventPlanningAt(event.eventStart, -7) : event.eventStart,
			),
		),

		...promotionReminders(event, now),
		...checklistReminder(event, now),
	];
	if (!event.feedbackEnabled) return reminders;
	const campaign = await latestCampaign(ctx, event._id);
	return [
		...reminders,
		...(await attendanceReminder(ctx, event, campaign, now)),
		...(await approvalReminder(ctx, event, campaign, now)),
	];
}
