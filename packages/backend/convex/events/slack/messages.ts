import {
	BIFROST_LOCAL_URL,
	BIFROST_URL,
	COMPANY_FIRST_CONTACT_TEMPLATE_URL,
	EVENT_EXPENSE_TEMPLATE_URL,
} from "@workspace/shared/constants";
import { featureFlags } from "@workspace/shared/feature-flags";
import {
	DATE_PATTERNS,
	EVENT_PLANNING,
	eventPlanningAt,
	feedbackOpensAt,
	feedbackRoundAt,
	formatOsloDate,
	REMINDER_DAYS,
} from "@workspace/shared/time";
import type { Doc } from "../../_generated/dataModel";
import { isLocalDevelopment } from "../../auth/local";
import type { getOrganizers } from "../queries";
import { REMINDER_LEAD_TIMES } from "../reminders/schedule";

export function escapeSlack(text: string) {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
export function eventUrl(event: Doc<"events">) {
	return `${isLocalDevelopment() ? BIFROST_LOCAL_URL : BIFROST_URL}/events/${event.slug ?? event._id}`;
}
// Planned follow-up: let the board edit routine message templates in Bifrost Resources.
export function eventMessage(
	event: Doc<"events">,
	organizers: Awaited<ReturnType<typeof getOrganizers>>,
	text: string,
) {
	const mentions = organizers.map(({ name, slackUserId }) =>
		slackUserId ? `<@${slackUserId}>` : escapeSlack(name),
	);
	return [
		`Halla ${mentions.join(" og ") || "folkens"}!`,
		`*${escapeSlack(event.title)}*, ${formatOsloDate(event.eventStart, DATE_PATTERNS.shortDateWithYear)}.`,
		text,
		`<${eventUrl(event)}|Åpne arrangementet og sjekklisten i Bifrost>`,
	].join("\n");
}

function participantReminders(event: Doc<"events">, now: number) {
	if (!event.remindersEnabled || !event.published) return [];
	return Object.values(REMINDER_LEAD_TIMES).flatMap((leadTime, index) => {
		const at = event.eventStart - leadTime;
		return at > now
			? [
					`• Sender påminnelse ${index + 1} til de påmeldte ${formatOsloDate(at, DATE_PATTERNS.dateTime)}.`,
				]
			: [];
	});
}

/** Describe only remaining work, using the same schedule and switches as the automations. */
function upcomingAutomations(event: Doc<"events">, now: number, campaignOpensAt?: number) {
	const when = (at: number) => formatOsloDate(at, DATE_PATTERNS.dateTime);
	const automatic: string[] = [];
	if (event.published && event.registrationOpens > now)
		automatic.push(`• Åpner påmeldingen ${when(event.registrationOpens)} og sier fra her.`);
	if (!event.remindersEnabled)
		automatic.push("• Automatiske påminnelser til påmeldte er slått av for dette arrangementet.");
	if (!event.feedbackEnabled)
		automatic.push(
			"• Automatisk innsamling av tilbakemeldinger er slått av for dette arrangementet.",
		);
	automatic.push(...participantReminders(event, now));
	if (event.feedbackEnabled) {
		const opensAt = campaignOpensAt ?? feedbackOpensAt(event.eventStart);
		if (opensAt > now)
			automatic.push(
				`• Sender tilbakemeldingsskjemaet til dem dere registrerer som møtt, ${when(opensAt)}.`,
			);
		const reminders = REMINDER_DAYS.map((days) => feedbackRoundAt(opensAt, days)).filter(
			(at) => at > now,
		);
		if (reminders.length)
			automatic.push(
				`• Minner dem som ikke har svart på skjemaet: ${reminders.map(when).join("; ")}.`,
			);
		if (featureFlags.huginFeedback.reportsEnabled)
			automatic.push(
				"• Lager tilbakemeldingsrapporten når innsamlingen stenger. Jeg sender den til bedriften etter at dere har sett gjennom og godkjent den.",
			);
	}
	automatic.push(
		"• Sier fra her når arrangementet blir fullt eller mange melder seg av på kort tid.",
	);
	return automatic;
}

export function welcomeMessage(event: Doc<"events">, now: number, campaignOpensAt?: number) {
	const when = (at: number) => formatOsloDate(at, DATE_PATTERNS.dateTime);
	const automatic = upcomingAutomations(event, now, campaignOpensAt);
	const contactAt = eventPlanningAt(event.eventStart, EVENT_PLANNING.companyContactDaysBefore);
	const contact =
		contactAt > now
			? `Ta kontakt med bedriften innen ${when(contactAt)}`
			: "Ta kontakt med bedriften nå, hvis dere ikke allerede har gjort det";
	return [
		"Så hyggelig at dere skal arrangere! 👋 Her er planen videre. Kanalen deles med de andre arrangementene med samme bedrift dette semesteret.",
		"",
		"*Dette gjør jeg*",
		...automatic,
		"",
		"*Dette gjør dere*",
		`• ${contact}. Bruk <${COMPANY_FIRST_CONTACT_TEMPLATE_URL}|malen for førstegangskontakt fra Ressurser>.`,
		"• Avklar rom, mat og praktisk opplegg med bedriften, og fordel oppgavene mellom dere.",
		"• Registrer oppmøte i Bifrost på arrangementsdagen.",
		...(eventPlanningAt(event.eventStart, EVENT_PLANNING.practicalDaysBefore) > now
			? [
					`• Jeg minner hovedansvarlige på det dere skal ta med ${when(eventPlanningAt(event.eventStart, EVENT_PLANNING.practicalDaysBefore))}.`,
				]
			: []),
		`• Send inn utlegg og kvitteringer etter arrangementet. Jeg minner hovedansvarlige på dette ${when(eventPlanningAt(event.eventStart, -EVENT_PLANNING.expensesDaysAfter))}.`,
		...(event.feedbackEnabled
			? ["• Se gjennom og godkjenn rapporten når jeg sier fra at den er klar."]
			: []),
	].join("\n");
}

export function timedOrganizerReminders(event: Doc<"events">) {
	return [
		{
			key: "practical",
			at: eventPlanningAt(event.eventStart, EVENT_PLANNING.practicalDaysBefore),
			text: "Snart er det klart! Husk Navet-merch, vann og kaffe til bedriftsrepresentantene. Ta med en laptop så en medhjelper kan registrere oppmøte, og skåler hvis dere kjøper snacks. Ta vare på alle kvitteringer, også når dere bruker Navet-kortet. 😊",
		},
		{
			key: "expenses",
			at: eventPlanningAt(event.eventStart, -EVENT_PLANNING.expensesDaysAfter),
			text: `Takk for i går! Husk å sende inn utlegg med kvitteringer, også for kjøp med Navet-kortet. Her er <${EVENT_EXPENSE_TEMPLATE_URL}|utleggsmalen for personlige utlegg og Navet-kortet>. 🧾`,
		},
	];
}
