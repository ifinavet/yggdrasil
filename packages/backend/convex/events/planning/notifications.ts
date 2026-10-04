import { BIFROST_LOCAL_URL, BIFROST_URL } from "@workspace/shared/constants";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import type { Doc } from "../../_generated/dataModel";
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
