import { BIFROST_LOCAL_URL, BIFROST_URL } from "@workspace/shared/constants";
import { hasEventText } from "@workspace/shared/events/checklist";
import {
	AGE_CHOICES,
	ANSWER_CHOICES,
	type PlanningAnswers,
	VENUE_CHOICES,
} from "@workspace/shared/events/planning";
import { EVENT_TYPE_LABELS, FOOD_PURCHASER_LABELS } from "@workspace/shared/semester/labels";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { enqueueSystemMessage } from "../../iam/notifications";
import { getOrganizers } from "../queries";
import { escapeSlack } from "../slack/messages";
import { queueEventNotification } from "../slack/state";

export function planningUrl(event: Doc<"events">, modal = "prepare") {
	return `${isLocalDevelopment() ? BIFROST_LOCAL_URL : BIFROST_URL}/events/${event._id}?planning=${modal}`;
}
export async function notifyPlanning(
	ctx: MutationCtx,
	event: Doc<"events">,
	key: string,
	text: string,
	modal = "prepare",
) {
	const message = `${text} <${planningUrl(event, modal)}|Åpne i Bifrost>.`;
	await queueEventNotification(ctx, event._id, `planning:${key}`, message);
	const organizers = await getOrganizers(ctx, event._id);
	const mentions = organizers.flatMap((o) => (o.slackUserId ? [`<@${o.slackUserId}>`] : []));
	await enqueueSystemMessage(ctx, {
		channel: SYSTEM_ALERTS_CHANNEL,
		clientMsgId: `planning:${event._id}:${key}`,
		text: `${escapeSlack(event.title)}\n${message}\n${mentions.join(" ")}`,
	});
}

export async function notifyInvitationSent(
	ctx: MutationCtx,
	email: Doc<"eventPlanningEmails">,
	status: Doc<"eventPlanningEmails">["status"],
) {
	if (email.kind !== "invitation" || (status !== "sent" && status !== "delivered")) return;
	const planning = await ctx.db.get(email.planningId);
	const event = planning ? await ctx.db.get(planning.eventId) : null;
	if (!event || event.hostingCompany !== planning?.companyId) return;
	await notifyPlanning(
		ctx,
		event,
		`email-sent:${email._id}`,
		`Invitasjonen til å planlegge bedriftspresentasjonen er sendt til ${escapeSlack(email.envelope.to)}. Vi venter på bedriftens svar.`,
		"delivery",
	);
}

export function planningResponseSummary(companyName: string, answers: PlanningAnswers) {
	const short = (value: string) => {
		const text = value.replace(/\s+/g, " ").trim();
		return escapeSlack(text.length > 180 ? `${text.slice(0, 180)}…` : text || "Ikke oppgitt");
	};
	const lines = [
		`${short(companyName)} har svart på mail for planlegging.`,
		"",
		`Tittel: ${short(answers.title)}`,
		`Kort introduksjon: ${short(answers.teaser)}`,
		`Beskrivelse: ${hasEventText(answers.description) ? "Fylt ut" : "Ikke oppgitt"}`,
		`Sted: ${VENUE_CHOICES[answers.venue]}`,
		`Adresse eller lokale: ${short(answers.location)}`,
		`Start: ${answers.startTime}`,
		`Antall studenter: ${answers.capacity}`,
		`Mat og drikke: ${ANSWER_CHOICES[answers.foodAndDrinks]}`,
		`Alkohol: ${ANSWER_CHOICES[answers.alcohol]} (${AGE_CHOICES[answers.ageRestriction]})`,
		`Stand: ${ANSWER_CHOICES[answers.stand]}`,
		`Språk: ${short(answers.language)}`,
	];
	if (answers.requestedEventType)
		lines.push(`Ønsket arrangementstype: ${EVENT_TYPE_LABELS[answers.requestedEventType]}`);
	if (answers.foodAndDrinks === "yes") {
		lines.push(
			`Servering: ${short(answers.food)}`,
			`Hvem ordner serveringen: ${answers.foodPurchasedBy === "company" ? "Bedriften" : FOOD_PURCHASER_LABELS[answers.foodPurchasedBy]}`,
		);
	}
	if (answers.stand === "yes") lines.push(`Ønsker for stand: ${short(answers.standDetails)}`);
	if (answers.notes.trim()) lines.push(`Andre ønsker: ${short(answers.notes)}`);
	lines.push("", "Se gjennom, rediger og godkjenn før arrangementet publiseres på nettsiden.");
	return lines.join("\n");
}

export async function notifyInvitationApproved(
	ctx: MutationCtx,
	event: Doc<"events">,
	user: Doc<"users">,
	emailId: Id<"eventPlanningEmails">,
	recipient: string,
) {
	const company = await ctx.db.get(event.hostingCompany);
	const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
	await enqueueSystemMessage(ctx, {
		channel: SYSTEM_ALERTS_CHANNEL,
		clientMsgId: `planning:${event._id}:send-approved:${emailId}`,
		text: `${escapeSlack(name)} har godkjent mail for førstegangskontakt til ${escapeSlack(company?.name ?? event.title)} (${escapeSlack(recipient)}). E-posten er lagt i kø for utsending. <${planningUrl(event, "delivery")}|Åpne i Bifrost>.`,
	});
}
