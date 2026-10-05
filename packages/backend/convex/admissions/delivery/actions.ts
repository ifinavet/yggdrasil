"use node";

import { render, toPlainText } from "@react-email/render";
import AdmissionsCancellationEmail from "@workspace/emails/admissions-cancellation-email";
import AdmissionsInterviewEmail from "@workspace/emails/admissions-interview-email";
import AdmissionsOfferEmail from "@workspace/emails/admissions-offer-email";
import AdmissionsRejectionEmail from "@workspace/emails/admissions-rejection-email";
import { roomUrl } from "@workspace/shared/admissions";
import { EVENT_CONTACT_EMAIL, INFO_EMAIL } from "@workspace/shared/constants/contact";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { formatOsloDate } from "@workspace/shared/time";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { type ActionCtx, internalAction } from "../../_generated/server";
import { googleConfig, isWorkspaceEmail } from "../../iam/config";
import {
	calendarEventId,
	googleCalendarClient,
	overlapsBusy,
	readExternalBusy,
} from "../../iam/googleCalendar";
import { postSlackNotice } from "../../iam/slack";
import { trackedEmail } from "../../lib/trackedEmail";
import { operationValidator } from "../schema";
import {
	admissionsSlack,
	archiveAdmissionsChannel,
	ensureAdmissionsChannel,
	type Slack,
} from "./slack";
import type { Operation } from "./workflow";

const ADMISSIONS_URL = `${huginUrl()}/admissions`;
const MINUTE = 60_000;

function when(startAt: number) {
	return formatOsloDate(startAt, "EEEE d. MMMM yyyy, HH:mm");
}

function current(ctx: ActionCtx, operation: Operation) {
	return ctx.runQuery(internal.admissions.internal.operationIsCurrent, { operation });
}

async function admissionsChannel(
	ctx: ActionCtx,
	slack: Slack,
	period: Doc<"admissionPeriods">,
	people: Array<{ email: string }>,
): Promise<string> {
	return ensureAdmissionsChannel(slack, period, people, (memberIds) =>
		ctx.runMutation(internal.admissions.internal.saveSlackManagedMembers, {
			periodId: period._id,
			expectedRevision: period.revision,
			memberIds,
		}),
	);
}

async function requireCurrentPublish(ctx: ActionCtx, claimed: DeliveryContext) {
	if (await current(ctx, claimed.job)) return;
	await queueLatePublishCleanup(ctx, claimed);
	throw new StaleAdmissionJob();
}

async function queueLatePublishCleanup(ctx: ActionCtx, claimed: DeliveryContext) {
	if (!claimed.interview) return;
	await ctx.runMutation(internal.admissions.delivery.cancellation.queueStalePublishCleanup, {
		periodId: claimed.period._id,
		interviewId: claimed.interview._id,
		publishedRevision: claimed.job.revision,
	});
}

async function deliverEmail(
	ctx: ActionCtx,
	claimed: DeliveryContext,
	kind: Doc<"admissionDeliveries">["kind"],
	key: string,
	subject: string,
	template: Parameters<typeof render>[0],
) {
	const { period, application, applicant, job } = claimed;
	if (!application || !applicant) throw new Error("Fant ikke søknaden eller søkeren.");
	const html = await render(template);
	if (job.kind === "publish") await requireCurrentPublish(ctx, claimed);
	else if (!(await current(ctx, job))) throw new StaleAdmissionJob();
	const emailId = await trackedEmail.sendEmail(ctx, {
		from: `Navet <${INFO_EMAIL}>`,
		replyTo: [EVENT_CONTACT_EMAIL],
		to: applicant.email,
		subject,
		html,
		text: toPlainText(html),
		idempotencyKey: key,
	});
	await ctx.runMutation(internal.admissions.delivery.tracking.recordQueued, {
		periodId: period._id,
		applicationId: application._id,
		kind,
		idempotencyKey: key,
		emailId,
	});
	return emailId;
}

function emailProps(claimed: DeliveryContext) {
	return {
		firstName: claimed.applicant?.name.trim().split(/\s+/)[0] ?? "",
		periodTitle: claimed.period.title,
	};
}

function interviewEmailProps(claimed: DeliveryContext) {
	if (!claimed.interview) throw new StaleAdmissionJob();
	return {
		...emailProps(claimed),
		when: when(claimed.interview.startAt),
		room: claimed.interview.room,
		applicationUrl: ADMISSIONS_URL,
	};
}

type DeliveryContext = NonNullable<Awaited<ReturnType<typeof context>>>;

function googleConfigOrThrow() {
	const config = googleConfig();
	if (!config)
		throw new Error("Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.");
	return config;
}

function interviewContacts(claimed: DeliveryContext) {
	const { period, interview, interviewers } = claimed;
	if (!interview) throw new Error("Fant ikke intervjuet.");
	if (interview.interviewerIds.length < 2)
		throw new Error("Et intervju må ha minst to intervjuere.");
	return interview.interviewerIds.map((userId) => {
		const person = interviewers.find((entry) => entry.userId === userId);
		const selection = period.interviewers.find((entry) => entry.userId === userId);
		if (!person || !selection?.selectedCalendarIds.length)
			throw new Error("En intervjuer mangler e-post eller en valgt kalender.");
		return { ...person, calendars: selection.selectedCalendarIds };
	});
}

async function assertInterviewerAvailability(
	config: NonNullable<ReturnType<typeof googleConfig>>,
	person: ReturnType<typeof interviewContacts>[number],
	claimed: DeliveryContext,
) {
	const { interview, period } = claimed;
	if (!interview) throw new Error("Fant ikke intervjuet.");
	if (!isWorkspaceEmail(person.email, config.domain))
		throw new Error("Intervjueren mangler en Navet Workspace-konto for kalenderdelegering.");
	const endWithBuffer = interview.endAt + period.buffer * MINUTE;
	const client = googleCalendarClient(config, person.email);
	const from = new Date(interview.startAt).toISOString();
	const to = new Date(endWithBuffer).toISOString();
	const ownedEvents = new Map([
		[
			interview._id,
			{
				eventId:
					interview.calendarEventId ?? (await calendarEventId(`navet-admissions:${interview._id}`)),
				interviewId: interview._id,
				periodId: period._id,
			},
		],
	]);
	const busy = await readExternalBusy(client, person.calendars, from, to, ownedEvents);
	if (busy.flat().some((interval) => overlapsBusy(interval, interview.startAt, endWithBuffer)))
		throw new Error(
			"En intervjuer er opptatt i en valgt kalender. Endre tidspunktet før publisering.",
		);
}

async function publish(ctx: ActionCtx, claimed: DeliveryContext) {
	const { period, application, interview, applicant, job } = claimed;
	if (!application || !interview || !applicant || interview.status !== "scheduled")
		throw new Error("Intervjuet finnes ikke lenger eller er avlyst.");
	const contacts = interviewContacts(claimed);
	const config = googleConfigOrThrow();
	await Promise.all(
		contacts.map((person) => assertInterviewerAvailability(config, person, claimed)),
	);

	if (!(await current(ctx, job))) throw new StaleAdmissionJob();
	const owner = contacts[0];
	if (!owner) throw new Error("Fant ingen kalenderansvarlig for intervjuet.");
	const eventId =
		interview.calendarEventId ?? (await calendarEventId(`navet-admissions:${interview._id}`));
	const event = {
		summary: `Opptaksintervju, ${period.title}`,
		location: interview.room,
		start: { dateTime: new Date(interview.startAt).toISOString(), timeZone: period.timezone },
		end: { dateTime: new Date(interview.endAt).toISOString(), timeZone: period.timezone },
		attendees: [
			...new Map([
				[applicant.email.toLowerCase(), { email: applicant.email }],
				...contacts
					.filter((person) => person.userId !== owner.userId)
					.map((person) => [person.email.toLowerCase(), { email: person.email }] as const),
			]).values(),
		],
		visibility: "private",
		guestsCanModify: false,
		extendedProperties: {
			shared: {
				navetAdmissionsPeriodId: period._id,
				navetAdmissionsInterviewId: interview._id,
			},
		},
	};
	try {
		await googleCalendarClient(config, owner.email).upsertEvent("primary", eventId, event);
	} catch (error) {
		if (!(await current(ctx, job))) await queueLatePublishCleanup(ctx, claimed);
		throw error;
	}
	await requireCurrentPublish(ctx, claimed);

	const emailKey = `admission:interview:${interview._id}:${interview.revision}:invite`;
	await deliverEmail(
		ctx,
		claimed,
		"interview_invite",
		emailKey,
		`Intervju for ${period.title}`,
		AdmissionsInterviewEmail(interviewEmailProps(claimed)),
	);
	await requireCurrentPublish(ctx, claimed);
	const slack = admissionsSlack();
	const tags = (await Promise.all(contacts.map((person) => slack.lookupByEmail(person.email))))
		.filter((id): id is string => id !== null)
		.map((id) => `<@${id}>`)
		.join(", ");
	await sendNotice(
		ctx,
		claimed,
		`Intervju publisert ${when(interview.startAt)} i ${interview.room} (${roomUrl(interview.room)}). Intervjuere: ${tags}`,
		`published:${interview._id}:${interview.revision}`,
	);
	return eventId;
}

async function sendDecision(ctx: ActionCtx, claimed: DeliveryContext) {
	const { period, application, applicant } = claimed;
	if (!application || !applicant) throw new Error("Fant ikke søknaden eller søkeren.");
	if (application.decision !== "accepted" && application.decision !== "rejected")
		throw new Error("Søknaden har ikke et endelig svar.");
	const offer = application.decision === "accepted";
	const kind = offer ? "offer" : "rejection";
	const key = `admission:decision:${application._id}:${application.decisionRevision}:${kind}`;
	await deliverEmail(
		ctx,
		claimed,
		kind,
		key,
		offer ? `Tilbud om plass i Navet, ${period.title}` : `Svar på søknaden til ${period.title}`,
		offer
			? AdmissionsOfferEmail({
					...emailProps(claimed),
					group: application.reviewedGroup ?? "Navet",
					responseUrl: ADMISSIONS_URL,
				})
			: AdmissionsRejectionEmail(emailProps(claimed)),
	);
}

async function remind(ctx: ActionCtx, claimed: DeliveryContext, days: 1 | 3) {
	const { period, application, interview, applicant } = claimed;
	if (!application || !interview || !applicant || interview.status !== "scheduled")
		throw new Error("Intervjuet finnes ikke lenger eller er avlyst.");
	const kind = days === 3 ? "reminder_3d" : "reminder_1d";
	const key = `admission:interview:${interview._id}:${interview.revision}:reminder-${days}d`;
	await deliverEmail(
		ctx,
		claimed,
		kind,
		key,
		`Påminnelse om intervju, ${period.title}`,
		AdmissionsInterviewEmail({ ...interviewEmailProps(claimed), reminder: true }),
	);
	if (days === 1)
		await sendNotice(
			ctx,
			claimed,
			`Påminnelse: intervjuet er ${when(interview.startAt)} i ${interview.room} (${roomUrl(interview.room)}).`,
			`reminder-1d:${interview._id}:${interview.revision}`,
		);
}

async function cancelCalendarEvent(ctx: ActionCtx, claimed: DeliveryContext) {
	const { interview, interviewers, job } = claimed;
	if (!interview) return;
	const owner = interviewers.find((person) => person.userId === interview.interviewerIds[0]);
	if (!owner) throw new Error("Fant ikke kalenderansvarlig for avlysningen.");
	if (!(await current(ctx, job))) throw new StaleAdmissionJob();
	const config = googleConfigOrThrow();
	if (!isWorkspaceEmail(owner.email, config.domain))
		throw new Error("Intervjueren mangler en Navet Workspace-konto for kalenderdelegering.");
	const client = googleCalendarClient(config, owner.email);
	const eventId =
		interview.calendarEventId ?? (await calendarEventId(`navet-admissions:${interview._id}`));
	const event = await client.getEvent("primary", eventId);
	if (!event) return;
	if (
		event.extendedProperties?.shared?.navetAdmissionsPeriodId !== interview.periodId ||
		event.extendedProperties?.shared?.navetAdmissionsInterviewId !== interview._id
	)
		throw new Error("Kalenderhendelsen mangler opptakets eierskapsmetadata; den ble ikke slettet.");
	if (!(await current(ctx, job))) throw new StaleAdmissionJob();
	await client.cancelEvent("primary", eventId);
}

async function cancelInterview(ctx: ActionCtx, claimed: DeliveryContext) {
	const { interview, applicant, application } = claimed;
	if (!interview) return;
	await cancelCalendarEvent(ctx, claimed);
	await sendNotice(
		ctx,
		claimed,
		`Et intervju i ${claimed.period.title} er avlyst. Kalenderinvitasjonen er oppdatert.`,
		`cancelled:${interview._id}:${interview.revision}`,
	);
	if (!claimed.job.notifyApplicant || interview.startAt <= Date.now() || !applicant || !application)
		return;
	await deliverEmail(
		ctx,
		claimed,
		"cancelled",
		`admission:interview:${interview._id}:${interview.revision}:cancelled`,
		`Intervjuet er avlyst, ${claimed.period.title}`,
		AdmissionsCancellationEmail(interviewEmailProps(claimed)),
	);
}

async function sendNotice(
	ctx: ActionCtx,
	claimed: DeliveryContext,
	message: string,
	key = claimed.job.idempotencyKey,
) {
	if (!(await current(ctx, claimed.job))) throw new StaleAdmissionJob();
	const slack = admissionsSlack();
	const channel = await admissionsChannel(ctx, slack, claimed.period, claimed.selectedInterviewers);
	await postSlackNotice(
		slack,
		channel,
		key,
		claimed.interview?._creationTime ?? claimed.period._creationTime,
		message,
	);
}

async function runJob(ctx: ActionCtx, claimed: DeliveryContext) {
	switch (claimed.job.kind) {
		case "publish":
			return publish(ctx, claimed);
		case "send_decision":
			return sendDecision(ctx, claimed);
		case "remind_3d":
			return remind(ctx, claimed, 3);
		case "remind_1d":
			return remind(ctx, claimed, 1);
		case "cancel_interview":
			return cancelInterview(ctx, claimed);
		case "offer_declined":
			await sendNotice(
				ctx,
				claimed,
				`En søker takket nei til tilbudet fra ${claimed.period.title}. Kandidaten er tilgjengelig for ny vurdering.`,
			);
			return;
		case "archive_channel":
			if (!(await current(ctx, claimed.job))) throw new StaleAdmissionJob();
			await archiveAdmissionsChannel(admissionsSlack(), claimed.period);
			return;
		case "delivery_failure":
			if (!claimed.delivery) throw new Error("Fant ikke den feilede e-postleveringen.");
			await sendNotice(
				ctx,
				claimed,
				`En e-postlevering trenger oppfølging (${claimed.delivery.kind}, ${claimed.delivery.status}) for ${claimed.period.title}. Kontroller opptaksoversikten.`,
			);
			return;
		case "sync_channel":
			if (!(await current(ctx, claimed.job))) throw new StaleAdmissionJob();
			await admissionsChannel(ctx, admissionsSlack(), claimed.period, claimed.selectedInterviewers);
			return;
	}
}

class StaleAdmissionJob extends Error {}

const context = (ctx: ActionCtx, operation: Operation) =>
	ctx.runQuery(internal.admissions.internal.deliveryContext, { operation });

export const execute = internalAction({
	args: { operation: operationValidator },
	handler: async (ctx, { operation }) => {
		const claimed = await context(ctx, operation);
		if (!claimed) return;
		try {
			const calendarEventId = await runJob(ctx, claimed);
			await ctx.runMutation(internal.admissions.internal.completeDelivery, {
				operation,
				calendarEventId: calendarEventId ?? undefined,
			});
		} catch (error) {
			if (!(error instanceof StaleAdmissionJob)) throw error;
		}
	},
});
