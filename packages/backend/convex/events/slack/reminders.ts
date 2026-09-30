import {
	BIFROST_LOCAL_URL,
	BIFROST_URL,
	COMPANY_FIRST_CONTACT_TEMPLATE_URL,
	UIO_STAND_GUIDELINES_URL,
} from "@workspace/shared/constants";
import { EVENT_CHECKLIST, hasEventText } from "@workspace/shared/events/checklist";
import {
	DAY_MS,
	EVENT_PLANNING,
	eventPlanningAt,
	feedbackOpensAt,
	HOUR_MS,
} from "@workspace/shared/time";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { previousCompanyReport } from "../../companies/history";
import { latestCampaign } from "../../feedback/delivery/campaigns";
import { eventUrl, timedOrganizerReminders } from "./messages";

type Reminder = { key: string; at: number; text: string };
const due = (at: number, now: number) => now >= at && now < at + DAY_MS;

async function contactReminder(
	ctx: QueryCtx,
	event: Doc<"events">,
	now: number,
): Promise<Reminder[]> {
	const at = eventPlanningAt(event.eventStart, EVENT_PLANNING.companyContactDaysBefore);
	if (!due(at, now) || event.completedChecklistSteps?.includes("company-contact")) return [];
	const previous = await previousCompanyReport(ctx, event, now);
	const origin = isLocalDevelopment() ? BIFROST_LOCAL_URL : BIFROST_URL;
	const history = previous
		? ` Ta gjerne med lærdom fra <${origin}${previous}|rapporten fra forrige arrangement>.`
		: "";
	return [
		{
			key: "company-contact",
			at,
			text: `Nå er det på tide å ta kontakt med bedriften 😊 Send dem en e-post og avklar det praktiske. Her er <${COMPANY_FIRST_CONTACT_TEMPLATE_URL}|malen for førstegangskontakt fra Ressurser>. Hør også om de vil ha stand, og bruk <${UIO_STAND_GUIDELINES_URL}|UiOs skjema og retningslinjer for stand>.${history}`,
		},
	];
}

function promotionReminders(event: Doc<"events">, now: number): Reminder[] {
	const missing = (["title", "teaser", "description"] as const)
		.filter((field) => !hasEventText(event[field]))
		.map((field) => ({ title: "tittel", teaser: "teaser", description: "beskrivelse" })[field]);
	const at = eventPlanningAt(event.eventStart, EVENT_PLANNING.textDaysBefore);
	if (due(at, now) && missing.length)
		return [
			{
				key: "missing-text",
				at,
				text: `Nå er det bare to uker igjen, og ${missing.join(", ")} mangler fortsatt ordentlig innhold. Dette må dere få på plass nå, så vi rekker å promotere arrangementet. <${eventUrl(event)}|Oppdater arrangementet>.`,
			},
		];
	const promotionAt = eventPlanningAt(event.registrationOpens, EVENT_PLANNING.promotionDaysBefore);
	if (!due(promotionAt, now) || event.completedChecklistSteps?.includes("promotion")) return [];
	const missingCopy = missing.length
		? ` ${missing.join(", ")} mangler fortsatt ordentlig innhold. <${eventUrl(event)}|Oppdater arrangementet>.`
		: "";
	return [
		{
			key: `promotion:${event.registrationOpens}`,
			at: promotionAt,
			text: `Påmeldingen åpner i morgen. Avklar promotering med PR-ansvarlig, så folk får det med seg. 📣${missingCopy}`,
		},
	];
}

function checklistReminder(event: Doc<"events">, now: number): Reminder[] {
	const at = eventPlanningAt(event.eventStart, EVENT_PLANNING.checklistDaysBefore);
	if (!due(at, now)) return [];
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
			text: `En uke igjen! Disse punktene står fortsatt åpne i sjekklisten: ${unfinished.map((step) => step.label.toLocaleLowerCase("nb")).join(", ")}. Kan dere få dem på plass?`,
		},
	];
}

async function attendanceReminder(
	ctx: QueryCtx,
	event: Doc<"events">,
	campaign: Doc<"feedbackCampaigns"> | null,
	now: number,
): Promise<Reminder[]> {
	const opensAt = campaign?.opensAt ?? feedbackOpensAt(event.eventStart);
	// There is no event end field. Warn one hour before feedback, strictly after the event start.
	const at = opensAt - HOUR_MS;
	if (now <= event.eventStart || now < at || now >= opensAt || campaign?.status === "cancelled")
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
	return [
		{
			key: "missing-attendance",
			at,
			text: `Jeg mangler oppmøtestatus for ${missing} påmeldte. Tilbakemeldingsskjemaet sendes snart, så <${eventUrl(event)}/registrations|registrer hvem som møtte> før utsendingen.`,
		},
	];
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
	if (!due(at, now)) return [];
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
		...timedOrganizerReminders(event).filter((item) => due(item.at, now)),
		...(await contactReminder(ctx, event, now)),
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
