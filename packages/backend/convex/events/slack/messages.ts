import { BIFROST_LOCAL_URL, BIFROST_URL } from "@workspace/shared/constants";
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
const ACTION_NOTICES = [
	"welcome:",
	"missing-slack:",
	"planning:ready:",
	"planning:review:",
	"planning:publish-error:",
	"planning:email-error:",
];
export function asksOrganizersToAct(key: string) {
	return ACTION_NOTICES.some((prefix) => key.startsWith(prefix));
}
export function organizerNames(organizers: { name: string; slackUserId?: string }[], tag: boolean) {
	return organizers.map(({ name, slackUserId }) =>
		tag && slackUserId ? `<@${slackUserId}>` : escapeSlack(name),
	);
}
// Planned follow-up: let the board edit routine message templates in Bifrost Resources.
export function eventMessage(
	event: Doc<"events">,
	organizers: Awaited<ReturnType<typeof getOrganizers>>,
	text: string,
	tag: boolean,
	scold = false,
) {
	const names = organizerNames(organizers, tag).join(" og ") || "folkens";
	return [
		scold ? `Ey! ${names}` : `Halla ${names}!`,
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
	const contactAt = eventPlanningAt(event.eventStart, EVENT_PLANNING.channelDaysBefore);
	const contact =
		contactAt > now
			? `Klargjør første kontakt med bedriften ${when(contactAt)}`
			: "Klargjør første kontakt med bedriften hvis dere ikke allerede har gjort det";
	return [
		"Så hyggelig at dere skal arrangere! 👋 Her er planen videre. Kanalen deles med de andre arrangementene med samme bedrift dette semesteret.",
		"",
		"*Dette gjør jeg*",
		...automatic,
		"",
		"*Dette gjør dere*",
		`• ${contact}. <${eventUrl(event)}?planning=prepare|Se over og send invitasjonen i Bifrost>.`,
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

export const registrationFullText = "Alle plassene er tatt! 🎉 Arrangementet er nå fullt.";
export const reportSentText =
	"Nå har jeg sendt tilbakemeldingsrapporten til bedriften. Takk for innsatsen! 🙌";
export function reminderSentText(kind: string) {
	return `Jeg har begynt å sende påminnelse ${kind === "week" ? 1 : 2} på e-post til dem som er påmeldt arrangementet. ✉️`;
}
export function feedbackSentText(round: number) {
	return round === 0
		? "Jeg har begynt å sende ut tilbakemeldingsskjemaet til deltakerne som møtte. ✉️"
		: `Jeg har begynt å sende påminnelse ${(REMINDER_DAYS as readonly number[]).indexOf(round) + 1} om tilbakemeldingsskjemaet til dem som ikke har svart ennå. ✉️`;
}
export function reportReadyText(totalResponses: number) {
	return totalResponses > 0
		? "Tilbakemeldingsrapporten er klar! 📊 Se gjennom svarene og godkjenn rapporten i Bifrost, så sender jeg den til bedriften."
		: "Tilbakemeldingsperioden er ferdig. Ingen svarte denne gangen, så det er ingen rapport å sende til bedriften.";
}
export function unregisterWaveText(summary: string, detail: string) {
	return `Jeg la merke til mange avmeldinger på kort tid. ${escapeSlack(summary)}. ${escapeSlack(detail)}`;
}
