import { EVENT_EXPENSE_TEMPLATE_URL } from "@workspace/shared/constants";
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
import { eventUrl } from "./messages";

export type ReminderInput = {
	ctx: QueryCtx;
	event: Doc<"events">;
	campaign: Doc<"feedbackCampaigns"> | null;
	now: number;
};

type ReminderStep<Facts> = {
	id?: string;
	at: number;
	until?: number;
	text: (facts: Facts, event: Doc<"events">) => string;
};

type FactsLoader<Facts> = (
	input: ReminderInput,
	step: ReminderStep<Facts>,
) => Facts | null | Promise<Facts | null>;

type ReminderDefinition<Facts> = {
	name: string;
	audience: "leads" | "organizers";
	scold?: boolean;
	steps: (input: ReminderInput) => ReminderStep<Facts>[] | Promise<ReminderStep<Facts>[]>;
} & ([Facts] extends [undefined] ? { facts?: FactsLoader<Facts> } : { facts: FactsLoader<Facts> });

export type Reminder = {
	key: string;
	at: number;
	text: string;
	audience: "leads" | "organizers";
	scold: boolean;
};

export type OrganizerReminder = {
	name: string;
	due: (input: ReminderInput) => Promise<Reminder | null>;
};

export function defineReminder<Facts = undefined>(
	definition: ReminderDefinition<Facts>,
): OrganizerReminder {
	return {
		name: definition.name,
		async due(input) {
			const steps = await definition.steps(input);
			const index = steps.filter((step) => step.at <= input.now).length - 1;
			const step = steps[index];
			const until = step?.until ?? steps[index + 1]?.at ?? Number.POSITIVE_INFINITY;
			if (!step || input.now >= until) return null;
			const facts = definition.facts ? await definition.facts(input, step) : (undefined as Facts);
			if (facts === null) return null;
			return {
				key: step.id ? `${definition.name}:${step.id}` : definition.name,
				at: step.at,
				text: step.text(facts, input.event),
				audience: definition.audience,
				scold: definition.scold ?? false,
			};
		},
	};
}

const practical = defineReminder({
	name: "practical",
	audience: "leads",
	steps: ({ event }) => [
		{
			at: eventPlanningAt(event.eventStart, EVENT_PLANNING.practicalDaysBefore),
			until: event.eventStart,
			text: () =>
				"Snart er det klart! Husk Navet-merch, vann og kaffe til bedriftsrepresentantene. Ta med en laptop så en medhjelper kan registrere oppmøte, og skåler hvis dere kjøper snacks. Ta vare på alle kvitteringer, også når dere bruker Navet-kortet. 😊",
		},
	],
});

const expenses = defineReminder({
	name: "expenses",
	audience: "leads",
	steps: ({ event }) => [
		{
			at: eventPlanningAt(event.eventStart, -EVENT_PLANNING.expensesDaysAfter),
			until: eventPlanningAt(event.eventStart, -EVENT_PLANNING.archiveDaysAfter),
			text: () =>
				`Takk for innsatsen! Husk å sende inn utlegg med kvitteringer, også for kjøp med Navet-kortet. Her er <${EVENT_EXPENSE_TEMPLATE_URL}|utleggsmalen for personlige utlegg og Navet-kortet>. 🧾`,
		},
	],
});

function missingTextFields(event: Doc<"events">) {
	return (["title", "teaser", "description"] as const)
		.filter((field) => !hasEventText(event[field]))
		.map((field) => ({ title: "tittel", teaser: "teaser", description: "beskrivelse" })[field]);
}

const missingText = defineReminder<string[]>({
	name: "missing-text",
	audience: "organizers",
	steps: ({ event }) => [
		{
			at: eventPlanningAt(event.eventStart, EVENT_PLANNING.textDaysBefore),
			until: event.eventStart,
			text: (missing, event) =>
				`${missing.join(", ")} mangler fortsatt ordentlig innhold. Dette må dere få på plass nå, så vi rekker å promotere arrangementet. <${eventUrl(event)}|Oppdater arrangementet>.`,
		},
	],
	facts: ({ event }) => {
		const missing = missingTextFields(event);
		return missing.length ? missing : null;
	},
});

const promotion = defineReminder<string[]>({
	name: "promotion",
	audience: "organizers",
	steps: ({ event }) => [
		{
			id: String(event.registrationOpens),
			at: eventPlanningAt(event.registrationOpens, EVENT_PLANNING.promotionDaysBefore),
			until: event.registrationOpens,
			text: (missing, event) => {
				const missingCopy = missing.length
					? ` ${missing.join(", ")} mangler fortsatt ordentlig innhold. <${eventUrl(event)}|Oppdater arrangementet>.`
					: "";
				return `Påmeldingen åpner snart. Avklar promotering med PR-ansvarlig, så folk får det med seg. 📣${missingCopy}`;
			},
		},
	],
	facts: async (input) => {
		if (input.event.completedChecklistSteps?.includes("promotion")) return null;
		if (await missingText.due(input)) return null;
		return missingTextFields(input.event);
	},
});

const unfinishedChecklist = defineReminder<string[]>({
	name: "unfinished-checklist",
	audience: "organizers",
	steps: ({ event }) => [
		{
			at: eventPlanningAt(event.eventStart, EVENT_PLANNING.checklistDaysBefore),
			until: event.eventStart,
			text: (unfinished) =>
				`Disse punktene står fortsatt åpne i sjekklisten: ${unfinished.join(", ")}. Kan dere få dem på plass?`,
		},
	],
	facts: ({ event }) => {
		const unfinished = EVENT_CHECKLIST.flatMap((phase) => [...phase.steps])
			.filter(
				(step) =>
					["room", "food", "helpers"].includes(step.id) &&
					!event.completedChecklistSteps?.includes(step.id),
			)
			.map((step) => step.label.toLocaleLowerCase("nb"));
		return unfinished.length ? unfinished : null;
	},
});

const attendanceOpensAt = ({ event, campaign }: ReminderInput) =>
	campaign?.opensAt ?? feedbackOpensAt(event.eventStart);

const registerAttendance = (event: Doc<"events">) =>
	`<${eventUrl(event)}/registrations|Registrer oppmøtet>, og gi "Ikke møtt" til dem som ikke kom.`;

const stillMissingAttendance = (missing: number, event: Doc<"events">) =>
	`🚨🚨 Oppmøtet for ${missing} påmeldte er FORTSATT ikke registrert! De får ikke skjemaet før dere fikser det, så fiks det nå. ${registerAttendance(event)}`;

const missingAttendance = defineReminder<number>({
	name: "missing-attendance",
	audience: "leads",
	scold: true,
	steps: (input) => {
		const opensAt = attendanceOpensAt(input);
		return [
			{
				at: opensAt - HOUR_MS,
				until: opensAt,
				text: (missing, event) =>
					`🚨 Dere har ikke registrert oppmøte for ${missing} påmeldte! Skjemaet går ut om en time, og bare til dem som er registrert som møtt. ${registerAttendance(event)}`,
			},
			{ id: "followup-1", at: opensAt + 4 * HOUR_MS, text: stillMissingAttendance },
			{ id: "followup-2", at: feedbackRoundAt(opensAt, 1), text: stillMissingAttendance },
			{
				id: "followup-3",
				at: feedbackRoundAt(opensAt, 2),
				text: (missing, event) =>
					`😠😠😠 Siste påminnelse! ${missing} påmeldte mangler fortsatt oppmøte, og de får ikke skjemaet før dere registrerer det. Kom igjen! ${registerAttendance(event)}`,
			},
			{
				id: "followup-4",
				at: feedbackRoundAt(opensAt, 3),
				until: input.campaign?.closesAt,
				text: (missing, event) =>
					`🤖🚨 Nå er det nok. ${missing} påmeldte mangler fortsatt oppmøte. Jeg har startet 3D-printeren på Sonen og printer meg en robotkropp, og så kommer jeg og finner deg på IFI hvis du ikke fikser dette ASAP. ${registerAttendance(event)}`,
			},
		];
	},
	facts: async (input, step) => {
		const { ctx, event, campaign, now } = input;
		if (
			!event.feedbackEnabled ||
			now <= event.eventStart ||
			campaign?.status === "cancelled" ||
			campaign?.status === "closed" ||
			(step.at >= attendanceOpensAt(input) && campaign?.status !== "open")
		)
			return null;
		let missing = 0;
		for await (const registration of ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
				q.eq("eventId", event._id).eq("status", "registered"),
			)) {
			if (!registration.attendanceStatus) missing++;
		}
		return missing || null;
	},
});

const reportApproval = defineReminder({
	name: "report-approval",
	audience: "organizers",
	steps: async ({ ctx, campaign }) => {
		if (!campaign) return [];
		const report = await ctx.db
			.query("feedbackReports")
			.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
			.unique();
		if (report?.status !== "draft" || report.totalResponses === 0) return [];
		return [
			{
				id: report._id,
				at: eventPlanningAt(
					report.readyAt ?? report._creationTime,
					-EVENT_PLANNING.approvalDaysAfter,
				),
				text: (_, event) =>
					`En liten påminnelse: Rapporten venter fortsatt på gjennomgang. <${eventUrl(event)}/report|Se gjennom og godkjenn den>, så kan jeg sende den til bedriften. 😊`,
			},
		];
	},
});

export const ORGANIZER_REMINDERS = [
	practical,
	expenses,
	missingText,
	promotion,
	unfinishedChecklist,
	missingAttendance,
	reportApproval,
];

export async function dueOrganizerReminders(ctx: QueryCtx, event: Doc<"events">, now: number) {
	const campaign = event.feedbackEnabled ? await latestCampaign(ctx, event._id) : null;
	const input = { ctx, event, campaign, now };
	const reminders = await Promise.all(ORGANIZER_REMINDERS.map((reminder) => reminder.due(input)));
	return reminders.filter((reminder) => reminder !== null);
}
