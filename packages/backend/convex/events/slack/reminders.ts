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

/** All conditional notices are recalculated both when queued and immediately before sending. */
export async function dueOrganizerReminders(ctx: QueryCtx, event: Doc<"events">, now: number) {
	const due = (at: number) => now >= at && now < at + DAY_MS;
	const notices = timedOrganizerReminders(event).filter((item) => due(item.at));
	const add = (key: string, at: number, text: string) => {
		if (due(at)) notices.push({ key, at, text });
	};
	const contactAt = eventPlanningAt(event.eventStart, EVENT_PLANNING.companyContactDaysBefore);
	if (due(contactAt) && !(event.completedChecklistSteps ?? []).includes("company-contact")) {
		const previous = await previousCompanyReport(ctx, event, now);
		const origin = isLocalDevelopment() ? BIFROST_LOCAL_URL : BIFROST_URL;
		add(
			"company-contact",
			contactAt,
			`Nå er det på tide å ta kontakt med bedriften 😊 Send dem en e-post og avklar det praktiske. Her er <${COMPANY_FIRST_CONTACT_TEMPLATE_URL}|malen for førstegangskontakt fra Ressurser>. Hør også om de vil ha stand, og bruk <${UIO_STAND_GUIDELINES_URL}|UiOs skjema og retningslinjer for stand>.${previous ? ` Ta gjerne med lærdom fra <${origin}${previous}|rapporten fra forrige arrangement>.` : ""}`,
		);
	}
	const missingText = (["title", "teaser", "description"] as const)
		.filter((field) => !hasEventText(event[field]))
		.map((field) => ({ title: "tittel", teaser: "teaser", description: "beskrivelse" })[field]);
	const textAt = eventPlanningAt(event.eventStart, EVENT_PLANNING.textDaysBefore);
	const promotionAt = eventPlanningAt(event.registrationOpens, EVENT_PLANNING.promotionDaysBefore);
	const needsTextReminder = due(textAt) && missingText.length > 0;
	if (needsTextReminder)
		add(
			"missing-text",
			textAt,
			`Nå er det bare to uker igjen, og ${missingText.join(", ")} mangler fortsatt ordentlig innhold. Dette må dere få på plass nå, så vi rekker å promotere arrangementet. <${eventUrl(event)}|Oppdater arrangementet>.`,
		);
	if (!needsTextReminder && !(event.completedChecklistSteps ?? []).includes("promotion"))
		add(
			`promotion:${event.registrationOpens}`,
			promotionAt,
			`Påmeldingen åpner i morgen. Avklar promotering med PR-ansvarlig, så folk får det med seg. 📣${missingText.length ? ` ${missingText.join(", ")} mangler fortsatt ordentlig innhold. <${eventUrl(event)}|Oppdater arrangementet>.` : ""}`,
		);
	const checklistAt = eventPlanningAt(event.eventStart, EVENT_PLANNING.checklistDaysBefore);
	if (due(checklistAt)) {
		const unfinished = EVENT_CHECKLIST.flatMap((phase) => [...phase.steps]).filter(
			(step) =>
				["room", "food", "helpers"].includes(step.id) &&
				!(event.completedChecklistSteps ?? []).includes(step.id),
		);
		if (unfinished.length)
			add(
				"unfinished-checklist",
				checklistAt,
				`En uke igjen! Disse punktene står fortsatt åpne i sjekklisten: ${unfinished.map((step) => step.label.toLocaleLowerCase("nb")).join(", ")}. Kan dere få dem på plass?`,
			);
	}
	if (event.feedbackEnabled) {
		const campaign = await latestCampaign(ctx, event._id);
		const opensAt = campaign?.opensAt ?? feedbackOpensAt(event.eventStart);
		// There is no event end field. Warn one hour before feedback, strictly after the event start.
		const attendanceAt = opensAt - HOUR_MS;
		if (
			now > event.eventStart &&
			now >= attendanceAt &&
			now < opensAt &&
			campaign?.status !== "cancelled"
		) {
			let missingAttendance = 0;
			for await (const registration of ctx.db
				.query("registrations")
				.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
					q.eq("eventId", event._id).eq("status", "registered"),
				)) {
				if (!registration.attendanceStatus) missingAttendance++;
			}
			if (missingAttendance > 0)
				add(
					"missing-attendance",
					attendanceAt,
					`Jeg mangler oppmøtestatus for ${missingAttendance} påmeldte. Tilbakemeldingsskjemaet sendes snart, så <${eventUrl(event)}/registrations|registrer hvem som møtte> før utsendingen.`,
				);
		}
		if (campaign) {
			const report = await ctx.db
				.query("feedbackReports")
				.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
				.unique();
			if (report?.status === "draft" && report.totalResponses > 0)
				add(
					`report-approval:${report._id}`,
					eventPlanningAt(
						report.readyAt ?? report._creationTime,
						-EVENT_PLANNING.approvalDaysAfter,
					),
					`En liten påminnelse: Rapporten venter fortsatt på gjennomgang. <${eventUrl(event)}/report|Se gjennom og godkjenn den>, så kan jeg sende den til bedriften. 😊`,
				);
		}
	}
	return notices;
}
