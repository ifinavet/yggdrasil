import type { OrganizerRole } from "@workspace/shared/constants";
import { daysBeforeAt, formatEventDate, formatEventStart } from "@workspace/shared/slack/time";
import { asciiFilename } from "@workspace/shared/utils";

// Student-facing Slack copy for bedpres channels. Keep reminder keys stable: they record what was sent.

export type ChannelEvent = {
	title: string;
	company: string;
	eventStart: number;
	registrationOpens: number;
	// The event's slug, or its id when it has none; Bifrost accepts both in URLs.
	slug: string;
};

type Reminder = {
	key: string;
	at: (event: ChannelEvent) => number;
	text: (event: ChannelEvent) => string;
};

const HOUR = 60 * 60 * 1000;
const CHECKLIST_URL =
	"https://docs.google.com/document/d/1_kDHIg3P9HxWOX90wUEVhaBmFtMJig1gSMhzPERbqQA/edit?usp=sharing";

// Follows the responsible's checklist for a bedpres. Times are 09:00 in Oslo unless noted.
export const REMINDERS: readonly Reminder[] = [
	{
		key: "two-weeks",
		at: ({ eventStart }) => daysBeforeAt(eventStart, 14),
		text: ({ title }) =>
			[
				`*To uker igjen til ${title}.* Har dere:`,
				"• oppdatert arrangementet i Bifrost med informasjon fra bedriften? Serveres det alkohol, skriv at gyldig legitimasjon må tas med.",
				"• sjekket at påmeldingen i Bifrost åpner én uke før arrangementet?",
				"• booket stand, om bedriften vil ha det?",
				"• fordelt oppgavene mellom hovedansvarlig og medhjelpere?",
			].join("\n"),
	},
	{
		key: "registration",
		at: ({ registrationOpens }) => daysBeforeAt(registrationOpens, 1),
		text: ({ title, registrationOpens }) =>
			[
				`*Påmeldingen til ${title} åpner ${formatEventStart(registrationOpens)}.*`,
				"Del lenken i Facebook-gruppen Ifi-studenter i dag, med tidspunktet for åpning. Hvert arrangement kan bare promoteres to ganger i gruppen.",
			].join("\n"),
	},
	{
		key: "one-week",
		at: ({ eventStart }) => daysBeforeAt(eventStart, 7),
		text: () =>
			[
				"*En uke igjen.* Har dere:",
				"• sendt påminnelse-mail til de påmeldte (bruk mail-malen)? Kopier e-postlisten fra arrangementet i Bifrost, og bruk BCC.",
				"• sjekket påmeldingstallet? Er det ikke fullt, kontakt promoteringsansvarlig, lag stand eller del ut flyers.",
			].join("\n"),
	},
	{
		key: "two-days",
		at: ({ eventStart }) => daysBeforeAt(eventStart, 2),
		text: () =>
			[
				"*To dager igjen.* Har dere:",
				"• laget et «Oppmøte»-ark, i tilfelle oppmøtet må tas manuelt?",
				"• sendt ny påminnelse-mail med praktisk info, som legitimasjon og forberedelser?",
			].join("\n"),
	},
	{
		key: "event-day",
		at: ({ eventStart }) => daysBeforeAt(eventStart, 0),
		text: ({ title }) =>
			[
				`*I dag er det ${title}!* Husk:`,
				"• tallerkener, engangskopper, vann, kaffe, penner og PC til oppmøte.",
				"• å registrere oppmøte i Bifrost (bifrost.ifinavet.no, under Påmeldte): Oppmøtt, Møtt sent eller Ikke møtt. Alle må registreres for at prikksystemet skal fungere.",
				"• å ta vare på alle kvitteringer, også for Navet-kortet.",
				"• å minne deltakerne på slutten om at tilbakemeldingsskjemaet kommer på mail.",
				"Lurer dere på noe underveis? Spør i #general.",
			].join("\n"),
	},
	{
		key: "after-event",
		// Two hours after the start, when the presentation should be over.
		at: ({ eventStart }) => eventStart + 2 * HOUR,
		text: () =>
			[
				"*Takk for i dag!* Nå gjenstår det å:",
				"• registrere oppmøte i Bifrost, om det ikke er gjort. Tilbakemeldingsskjemaet sendes automatisk i morgen, men bare til dem som er registrert som møtt.",
				"• se gjennom og godkjenne rapporten til bedriften. Dere får beskjed her når den er klar, om omtrent to uker.",
				"• dele oppmøte-arket med arrangementsansvarlig, om dere brukte det.",
				"• føre utlegg for alt som er kjøpt inn. Dette er veldig viktig, fordi Navet er pliktig til å føre regnskap.",
			].join("\n"),
	},
];

/** Only the newest due reminder is posted; older missed ones are marked as handled. */
export function dueReminders(event: ChannelEvent, now: number, sent: readonly string[]) {
	const due = REMINDERS.filter(
		(reminder) => reminder.at(event) <= now && !sent.includes(reminder.key),
	)
		// Registration opens on its own date, so the order is only known per event.
		.sort((a, b) => a.at(event) - b.at(event));
	return { post: due.at(-1) ?? null, handled: due.map((reminder) => reminder.key) };
}

export function welcomeMessage({ title, company, eventStart }: ChannelEvent): string {
	return [
		`:wave: Hei! Denne kanalen er for bedpressen *${title}* med ${company}, ${formatEventStart(eventStart)}.`,
		`Her får dere påminnelser underveis, basert på <${CHECKLIST_URL}|sjekklisten>. Kanalen arkiveres dagen etter at rapporten fra tilbakemeldingene er klar, omtrent to uker etter arrangementet.`,
		"",
		"*Dette bør gjøres nå, 4–5 uker før:*",
		"• Send første mail til bedriften (bruk mail-malen), eller foreslå et kort planleggingsmøte. Kontaktinfo ligger i semesterplanen.",
		"• Avklar type, sted, antall deltakere og servering. Rom og restaurant bookes via organiseringsansvarlig.",
		"• Send «Hvordan holde bedpres» til bedriften. Hadde de bedpres forrige semester? Les rapporten og ta med tilbakemeldingene.",
		"• Hør når bedriften vil ha stand, og book standplass med en gang.",
		"• Be bedriften om tekst til arrangementet, og send den videre til promoteringsansvarlig.",
		"",
		"Spørsmål? Kontakt arrangementsansvarlig eller et annet styremedlem.",
	].join("\n");
}

export function membersMessage(members: { slackUserId: string; role: OrganizerRole }[]): string {
	return `Lagt til i kanalen: ${members.map(({ slackUserId, role }) => `<@${slackUserId}> (${role})`).join(", ")}`;
}

export function missingMemberMessage({ name, email }: { name: string; email: string }): string {
	return `Fant ingen Slack-bruker for ${name} (${email}). Legg dem til manuelt, eller be dem bruke samme e-post i Slack som i Bifrost.`;
}

/** Tags the hovedansvarlig, so the reminder notifies them and not only marks the channel unread. */
export function reminderMessage(text: string, slackUserIds: string[]): string {
	return [...slackUserIds.map((id) => `<@${id}>`), text].join(" ");
}

export function reportUrl({ slug }: ChannelEvent, bifrostUrl: string): string {
	return `${bifrostUrl}/events/${slug}/feedback/report`;
}

export function reportReadyMessage(event: ChannelEvent, responses: number, url: string): string {
	if (responses === 0)
		return `*Tilbakemeldingsperioden for ${event.title} er over.* Ingen deltakere svarte, så det er ingen rapport å sende til bedriften. Kanalen arkiveres i morgen.`;
	return [
		`*Rapporten fra ${event.title} er klar til godkjenning.* ${responses} ${responses === 1 ? "deltaker" : "deltakere"} svarte.`,
		`Se gjennom rapporten, skjul svar som ikke skal deles, og godkjenn den, så sendes den til bedriften: <${url}|Åpne rapporten i Bifrost>`,
		"Kanalen arkiveres i morgen.",
	].join("\n");
}

export const ARCHIVE_MESSAGE = "Bedpressen er ferdig, og kanalen arkiveres nå. Takk for innsatsen!";

/** Slack allows at most 80 lowercase characters. */
export function channelName({ company, eventStart }: ChannelEvent, attempt: number): string {
	const suffix = attempt > 1 ? `-${attempt}` : "";
	return (
		`${formatEventDate(eventStart)}-${asciiFilename(company)}`.slice(0, 80 - suffix.length) + suffix
	);
}
