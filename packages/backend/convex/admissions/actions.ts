"use node";

import { render, toPlainText } from "@react-email/render";
import AdmissionsCancellationEmail from "@workspace/emails/admissions-cancellation-email";
import AdmissionsInterviewEmail from "@workspace/emails/admissions-interview-email";
import AdmissionsOfferEmail from "@workspace/emails/admissions-offer-email";
import AdmissionsRejectionEmail from "@workspace/emails/admissions-rejection-email";
import AdmissionsReminderEmail from "@workspace/emails/admissions-reminder-email";
import { roomUrl } from "@workspace/shared/admissions";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { formatOsloDate } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { isLocalDevelopment } from "../auth/local";
import { googleConfig, isWorkspaceEmail } from "../iam/config";
import { externalBusyIntervals, googleCalendarClient, overlapsBusy } from "../iam/googleCalendar";
import { admissionCalendarEventId } from "./delivery/eventId";
import { sendAdmissionEmail } from "./delivery/mail";
import {
	admissionsSlack,
	archiveAdmissionsChannel,
	ensureAdmissionsChannel,
	postAdmissionsNotice,
	type Slack,
} from "./delivery/slack";

const ADMISSIONS_URL = `${huginUrl()}/admissions`;
const MINUTE = 60_000;

function when(startAt: number) {
	return formatOsloDate(startAt, "EEEE d. MMMM yyyy, HH:mm");
}

async function current(ctx: ActionCtx, idempotencyKey: string) {
	return await ctx.runQuery(internal.admissions.internal.outboxIsCurrent, { idempotencyKey });
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

async function requireCurrentPublish(ctx: ActionCtx, claimed: CurrentClaim) {
	if (await current(ctx, claimed.job.idempotencyKey)) return;
	await queueLatePublishCleanup(ctx, claimed);
	throw new StaleAdmissionJob();
}

async function queueLatePublishCleanup(ctx: ActionCtx, claimed: CurrentClaim) {
	if (isLocalDevelopment() || !claimed.interview) return;
	await ctx.runMutation(internal.admissions.compensation.queueStalePublishCleanup, {
		periodId: claimed.period._id,
		interviewId: claimed.interview._id,
		publishedRevision: claimed.job.revision,
	});
}

async function deliverEmail(
	ctx: ActionCtx,
	claimed: CurrentClaim,
	kind: Doc<"admissionDeliveries">["kind"],
	key: string,
	subject: string,
	template: Parameters<typeof render>[0],
) {
	const { period, application, applicant, job } = claimed;
	if (!application || !applicant) throw new Error("Fant ikke søknaden eller søkeren.");
	const html = await render(template);
	if (job.kind === "publish") await requireCurrentPublish(ctx, claimed);
	else if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	const emailId = await sendAdmissionEmail(ctx, {
		to: applicant.email,
		subject,
		html,
		text: toPlainText(html),
		idempotencyKey: key,
	});
	await ctx.runMutation(internal.admissions.delivery.recordQueued, {
		periodId: period._id,
		applicationId: application._id,
		kind,
		idempotencyKey: key,
		emailId,
		...(isLocalDevelopment()
			? { status: "delivered" as const, localPreview: { to: applicant.email, subject, html } }
			: {}),
	});
	return emailId;
}

function emailProps(claimed: CurrentClaim) {
	return {
		firstName: claimed.applicant?.name.trim().split(/\s+/)[0] ?? "",
		periodTitle: claimed.period.title,
	};
}

function interviewEmailProps(claimed: CurrentClaim) {
	if (!claimed.interview) throw new StaleAdmissionJob();
	return {
		...emailProps(claimed),
		when: when(claimed.interview.startAt),
		room: claimed.interview.room,
		applicationUrl: ADMISSIONS_URL,
	};
}

type ClaimedOutbox = NonNullable<Awaited<ReturnType<typeof claim>>>;
type CurrentClaim = Omit<ClaimedOutbox, "period"> & { period: Doc<"admissionPeriods"> };

function googleConfigOrThrow() {
	const config = googleConfig();
	if (!config)
		throw new Error("Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.");
	return config;
}

function interviewContacts(claimed: CurrentClaim) {
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
	claimed: CurrentClaim,
) {
	const { interview, period } = claimed;
	if (!interview) throw new Error("Fant ikke intervjuet.");
	if (!isWorkspaceEmail(person.email, config.domain))
		throw new Error("Intervjueren mangler en Navet Workspace-konto for kalenderdelegering.");
	const endWithBuffer = interview.endAt + period.buffer * MINUTE;
	const client = googleCalendarClient(config, person.email);
	const from = new Date(interview.startAt).toISOString();
	const to = new Date(endWithBuffer).toISOString();
	const calendars = await client.freeBusy(person.calendars, from, to);
	await Promise.all(
		person.calendars.map(async (calendarId) => {
			const busy = calendars?.[calendarId]?.busy ?? [];
			if (
				!busy.some((interval) =>
					overlapsBusy(
						{ start: Date.parse(interval.start), end: Date.parse(interval.end) },
						interview.startAt,
						endWithBuffer,
					),
				)
			)
				return;
			const events = await client.listEvents(calendarId, from, to);
			const ownedEvents = new Map([
				[
					interview._id,
					{
						eventId: interview.calendarEventId ?? admissionCalendarEventId(interview._id),
						interviewId: interview._id,
						periodId: period._id,
					},
				],
			]);
			if (
				externalBusyIntervals(events, ownedEvents).some((interval) =>
					overlapsBusy(interval, interview.startAt, endWithBuffer),
				)
			)
				throw new Error(
					"En intervjuer er opptatt i en valgt kalender. Endre tidspunktet før publisering.",
				);
		}),
	);
}

async function assertScheduleAvailable(
	claimed: CurrentClaim,
	contacts: ReturnType<typeof interviewContacts>,
) {
	if (isLocalDevelopment()) return;
	const config = googleConfigOrThrow();
	await Promise.all(
		contacts.map((person) => assertInterviewerAvailability(config, person, claimed)),
	);
}

async function publish(ctx: ActionCtx, claimed: CurrentClaim) {
	const { period, application, interview, applicant, job } = claimed;
	if (!application || !interview || !applicant || interview.status !== "scheduled")
		throw new Error("Intervjuet finnes ikke lenger eller er avlyst.");
	const local = isLocalDevelopment();
	const contacts = interviewContacts(claimed);
	await assertScheduleAvailable(claimed, contacts);

	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	const owner = contacts[0];
	if (!owner) throw new Error("Fant ingen kalenderansvarlig for intervjuet.");
	const eventId =
		interview.calendarEventId ??
		(local ? `local:${job.idempotencyKey}` : admissionCalendarEventId(interview._id));
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
	if (!local) {
		try {
			await googleCalendarClient(googleConfigOrThrow(), owner.email).upsertEvent(
				"primary",
				eventId,
				event,
			);
		} catch (error) {
			if (!(await current(ctx, job.idempotencyKey))) await queueLatePublishCleanup(ctx, claimed);
			throw error;
		}
	}
	await requireCurrentPublish(ctx, claimed);

	const emailKey = `admission:interview:${interview._id}:${interview.revision}:invite`;
	const emailId = await deliverEmail(
		ctx,
		claimed,
		"interview_invite",
		emailKey,
		`Intervju for ${period.title}`,
		AdmissionsInterviewEmail(interviewEmailProps(claimed)),
	);
	await requireCurrentPublish(ctx, claimed);
	const slack = local ? null : admissionsSlack();
	if (slack) {
		await requireCurrentPublish(ctx, claimed);
		const channel = await admissionsChannel(ctx, slack, period, claimed.selectedInterviewers);
		const tags = (await Promise.all(contacts.map((person) => slack.lookupByEmail(person.email))))
			.filter((id): id is string => id !== null)
			.map((id) => `<@${id}>`)
			.join(", ");
		await postAdmissionsNotice(
			slack,
			channel,
			`published:${interview._id}:${interview.revision}`,
			interview._creationTime,
			`Intervju publisert ${when(interview.startAt)} i ${interview.room} (${roomUrl(interview.room)}). Intervjuere: ${tags}`,
		);
	}
	return { calendarEventId: eventId, deliveryIds: [emailId] };
}

async function sendDecision(ctx: ActionCtx, claimed: CurrentClaim) {
	const { period, application, applicant } = claimed;
	if (!application || !applicant) throw new Error("Fant ikke søknaden eller søkeren.");
	if (application.decision !== "accepted" && application.decision !== "rejected")
		throw new Error("Søknaden har ikke et endelig svar.");
	const offer = application.decision === "accepted";
	const kind = offer ? "offer" : "rejection";
	const key = `admission:decision:${application._id}:${application.decisionRevision}:${kind}`;
	const emailId = await deliverEmail(
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

	return { deliveryIds: [emailId] };
}

async function remind(ctx: ActionCtx, claimed: CurrentClaim, days: 1 | 3) {
	const { period, application, interview, applicant } = claimed;
	if (!application || !interview || !applicant || interview.status !== "scheduled")
		throw new Error("Intervjuet finnes ikke lenger eller er avlyst.");
	const kind = days === 3 ? "reminder_3d" : "reminder_1d";
	const key = `admission:interview:${interview._id}:${interview.revision}:reminder-${days}d`;
	const emailId = await deliverEmail(
		ctx,
		claimed,
		kind,
		key,
		`Påminnelse om intervju, ${period.title}`,
		AdmissionsReminderEmail(interviewEmailProps(claimed)),
	);
	if (days === 1)
		await sendNotice(
			ctx,
			claimed,
			`Påminnelse: intervjuet er ${when(interview.startAt)} i ${interview.room} (${roomUrl(interview.room)}).`,
			`reminder-1d:${interview._id}:${interview.revision}`,
		);
	return { deliveryIds: [emailId] };
}

async function cancelCalendarEvent(ctx: ActionCtx, claimed: CurrentClaim) {
	const { interview, interviewers, job } = claimed;
	if (!interview || isLocalDevelopment()) return;
	const owner = interviewers.find((person) => person.userId === interview.interviewerIds[0]);
	if (!owner) throw new Error("Fant ikke kalenderansvarlig for avlysningen.");
	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	const config = googleConfigOrThrow();
	if (!isWorkspaceEmail(owner.email, config.domain))
		throw new Error("Intervjueren mangler en Navet Workspace-konto for kalenderdelegering.");
	const client = googleCalendarClient(config, owner.email);
	const eventId = interview.calendarEventId ?? admissionCalendarEventId(interview._id);
	const event = await client.getEvent("primary", eventId);
	if (!event) return;
	if (
		event.extendedProperties?.shared?.navetAdmissionsPeriodId !== interview.periodId ||
		event.extendedProperties?.shared?.navetAdmissionsInterviewId !== interview._id
	)
		throw new Error("Kalenderhendelsen mangler opptakets eierskapsmetadata; den ble ikke slettet.");
	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	await client.cancelEvent("primary", eventId);
}

async function sendCancellationEmail(ctx: ActionCtx, claimed: CurrentClaim) {
	const { period, interview, applicant, application, job } = claimed;
	if (!interview || !applicant || !application) throw new StaleAdmissionJob();
	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	const key = `admission:interview:${interview._id}:${interview.revision}:cancelled`;
	return deliverEmail(
		ctx,
		claimed,
		"cancelled",
		key,
		`Intervjuet er avlyst, ${period.title}`,
		AdmissionsCancellationEmail(interviewEmailProps(claimed)),
	);
}

async function cancelInterview(ctx: ActionCtx, claimed: CurrentClaim) {
	const { interview, applicant, application } = claimed;
	if (!interview) return {};
	await cancelCalendarEvent(ctx, claimed);
	if (!claimed.job.notifyApplicant || interview.startAt <= Date.now() || !applicant || !application)
		return {};
	const emailId = await sendCancellationEmail(ctx, claimed);
	await sendNotice(
		ctx,
		claimed,
		`Et intervju i ${claimed.period.title} er avlyst. Kalenderinvitasjonen er oppdatert.`,
		`cancelled:${interview._id}:${interview.revision}`,
	);
	return { deliveryIds: [emailId] };
}

async function sendNotice(
	ctx: ActionCtx,
	claimed: CurrentClaim,
	message: string,
	key = claimed.job.idempotencyKey,
) {
	if (isLocalDevelopment()) return;
	if (!(await current(ctx, claimed.job.idempotencyKey))) throw new StaleAdmissionJob();
	const slack = admissionsSlack();
	const channel = await admissionsChannel(ctx, slack, claimed.period, claimed.selectedInterviewers);
	await postAdmissionsNotice(
		slack,
		channel,
		key,
		claimed.interview?._creationTime ?? claimed.job.createdAt,
		message,
	);
}

async function runJob(ctx: ActionCtx, claimed: CurrentClaim, key: string) {
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
			return {};
		case "archive_channel":
			if (!isLocalDevelopment()) {
				if (!(await current(ctx, key))) throw new StaleAdmissionJob();
				await archiveAdmissionsChannel(admissionsSlack(), claimed.period);
			}
			return {};
		case "delivery_failure":
			if (!claimed.delivery) throw new Error("Fant ikke den feilede e-postleveringen.");
			await sendNotice(
				ctx,
				claimed,
				`En e-postlevering trenger oppfølging (${claimed.delivery.kind}, ${claimed.delivery.status}) for ${claimed.period.title}. Kontroller opptaksoversikten.`,
			);
			return {};
		case "sync_channel":
			if (!isLocalDevelopment()) {
				if (!(await current(ctx, key))) throw new StaleAdmissionJob();
				await admissionsChannel(
					ctx,
					admissionsSlack(),
					claimed.period,
					claimed.selectedInterviewers,
				);
			}
			return {};
	}
}

async function complete(
	ctx: ActionCtx,
	idempotencyKey: string,
	result?: { calendarEventId?: string; deliveryIds?: string[] },
) {
	await ctx.runMutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey,
		...(result ? { result } : {}),
	});
}

async function fail(ctx: ActionCtx, idempotencyKey: string, error: unknown) {
	await ctx.runMutation(internal.admissions.internal.failOutbox, {
		idempotencyKey,
		error:
			error instanceof Error
				? error.message.slice(0, 500)
				: "Admissions provider operation failed.",
		nextAttemptAt: Date.now(),
	});
}

async function process(ctx: ActionCtx, idempotencyKey: string) {
	const claimed = await claim(ctx, idempotencyKey);
	if (!claimed) return;
	if (!claimed.period) {
		await complete(ctx, idempotencyKey);
		return;
	}
	try {
		const result = await runJob(ctx, claimed as CurrentClaim, idempotencyKey);
		await complete(ctx, idempotencyKey, result);
	} catch (error) {
		if (error instanceof StaleAdmissionJob) return await complete(ctx, idempotencyKey);
		await fail(ctx, idempotencyKey, error);
		throw error;
	}
}

class StaleAdmissionJob extends Error {}

const claim = (ctx: ActionCtx, idempotencyKey: string) =>
	ctx.runMutation(internal.admissions.internal.claimOutbox, { idempotencyKey });

export const processOutbox = internalAction({
	args: { idempotencyKey: v.string() },
	handler: (ctx, { idempotencyKey }) => process(ctx, idempotencyKey),
});
