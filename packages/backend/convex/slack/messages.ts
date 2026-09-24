import type { OrganizerRole } from "@workspace/shared/constants";
import { daysBeforeAt, formatEventDate, formatEventStart } from "@workspace/shared/slack/time";
import { asciiFilename } from "@workspace/shared/utils";

// Student-facing Slack copy for bedpres channels. Keep reminder keys stable: they record what was sent.

export type ChannelEvent = { title: string; company: string; eventStart: number };

type Reminder = {
	key: string;
	at: (eventStart: number) => number;
	text: (event: ChannelEvent) => string;
};

const HOUR = 60 * 60 * 1000;

export const REMINDERS: readonly Reminder[] = [
	{
		key: "two-weeks",
		at: (eventStart) => daysBeforeAt(eventStart, 14),
		text: ({ title }) =>
			[
				`*To uker igjen til ${title}.* Har dere:`,
				"• avklart program, tidsplan og kontaktperson med bedriften?",
				"• booket rom og bestilt mat?",
				"• publisert arrangementet i Bifrost?",
			].join("\n"),
	},
	{
		key: "one-week",
		at: (eventStart) => daysBeforeAt(eventStart, 7),
		text: () =>
			[
				"*En uke igjen.* Har dere:",
				"• sjekket påmeldingstallet, og delt arrangementet videre om det trengs?",
				"• bekreftet mat og antall med leverandøren?",
				"• avklart AV-utstyr og hva bedriften trenger på dagen?",
			].join("\n"),
	},
	{
		key: "one-day",
		at: (eventStart) => daysBeforeAt(eventStart, 1),
		text: ({ title }) =>
			[
				`*I morgen er det ${title}.* Har dere:`,
				"• avtalt hvem som møter bedriften, og når?",
				"• fordelt hvem som tar oppmøteregistrering?",
				"• sendt praktisk info til bedriften, som adresse, rom og tidspunkt?",
			].join("\n"),
	},
	{
		key: "attendance",
		at: (eventStart) => eventStart + 2 * HOUR,
		text: () =>
			"*Takk for i dag!* Har dere registrert oppmøte i Bifrost? Oppmøtet avgjør hvem som får tilbakemeldingsskjemaet i morgen tidlig.",
	},
];

/** Only the newest due reminder is posted; older missed ones are marked as handled. */
export function dueReminders(eventStart: number, now: number, sent: readonly string[]) {
	const due = REMINDERS.filter(
		(reminder) => reminder.at(eventStart) <= now && !sent.includes(reminder.key),
	);
	return { post: due.at(-1) ?? null, handled: due.map((reminder) => reminder.key) };
}

export function welcomeMessage({ title, company, eventStart }: ChannelEvent): string {
	return [
		`:wave: Hei! Denne kanalen er for bedpressen *${title}* med ${company}, ${formatEventStart(eventStart)}.`,
		"Her får dere påminnelser om hva som bør være gjort underveis. Kanalen arkiveres når tilbakemeldingsskjemaet er sendt ut etter arrangementet.",
	].join("\n");
}

export function membersMessage(members: { slackUserId: string; role: OrganizerRole }[]): string {
	return `Lagt til i kanalen: ${members.map(({ slackUserId, role }) => `<@${slackUserId}> (${role})`).join(", ")}`;
}

export function missingMemberMessage({ name, email }: { name: string; email: string }): string {
	return `Fant ingen Slack-bruker for ${name} (${email}). Legg dem til manuelt, eller be dem bruke samme e-post i Slack som i Bifrost.`;
}

export const ARCHIVE_MESSAGE = "Bedpressen er ferdig, og kanalen arkiveres nå. Takk for innsatsen!";

/** Slack allows at most 80 lowercase characters. */
export function channelName({ company, eventStart }: ChannelEvent, attempt: number): string {
	const suffix = attempt > 1 ? `-${attempt}` : "";
	return (
		`bedpres-${formatEventDate(eventStart)}-${asciiFilename(company)}`.slice(
			0,
			80 - suffix.length,
		) + suffix
	);
}
