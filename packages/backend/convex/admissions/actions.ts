"use node";

import { createHash } from "node:crypto";
import { render } from "@react-email/render";
import AdmissionsCancellationEmail from "@workspace/emails/admissions-cancellation-email";
import AdmissionsInterviewEmail from "@workspace/emails/admissions-interview-email";
import AdmissionsOfferEmail from "@workspace/emails/admissions-offer-email";
import AdmissionsRejectionEmail from "@workspace/emails/admissions-rejection-email";
import AdmissionsReminderEmail from "@workspace/emails/admissions-reminder-email";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { formatOsloDate } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { isLocalDevelopment } from "../auth/local";
import { googleConfig } from "../iam/config";
import { externalBusyIntervals, googleCalendarClient, overlapsBusy } from "../iam/googleCalendar";
import { sendAdmissionEmail } from "./delivery/mail";
import {
	admissionsSlack,
	archiveAdmissionsChannel,
	ensureAdmissionsChannel,
	postAdmissionsNotice,
} from "./delivery/slack";

const OFFER_URL = `${huginUrl()}/admissions`;
const MINUTE = 60_000;
const MAX_RETRY = 30 * MINUTE;

function stableEventId(interviewId: string) {
	return createHash("sha256").update(`navet-admissions:${interviewId}`).digest("hex");
}

function when(startAt: number) {
	return formatOsloDate(startAt, "EEEE d. MMMM yyyy, HH:mm");
}

async function current(ctx: ActionCtx, idempotencyKey: string) {
	return await ctx.runQuery(internal.admissions.internal.outboxIsCurrent, { idempotencyKey });
}

async function deliverEmail(
	ctx: ActionCtx,
	args: {
		periodId: Id<"admissionPeriods">;
		applicationId: Id<"admissionApplications">;
		kind: "offer" | "rejection" | "interview_invite" | "reminder_3d" | "reminder_1d" | "cancelled";
		key: string;
		to: string;
		subject: string;
		html: string;
		text: string;
	},
) {
	const emailId = await sendAdmissionEmail(ctx, {
		to: args.to,
		subject: args.subject,
		html: args.html,
		text: args.text,
		idempotencyKey: args.key,
	});
	await ctx.runMutation(internal.admissions.delivery.recordQueued, {
		periodId: args.periodId,
		applicationId: args.applicationId,
		kind: args.kind,
		idempotencyKey: args.key,
		emailId,
		...(isLocalDevelopment() ? { status: "delivered" as const } : {}),
	});
	return emailId;
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
			if (
				externalBusyIntervals(events, interview._id, period._id).some((interval) =>
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
	const { period, application, interview, applicant, interviewers, job } = claimed;
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
		(local ? `local:${job.idempotencyKey}` : stableEventId(interview._id));
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
	if (!local)
		await googleCalendarClient(googleConfigOrThrow(), owner.email).upsertEvent(
			"primary",
			eventId,
			event,
		);
	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();

	const emailKey = `admission:interview:${interview._id}:${interview.revision}:invite`;
	const firstName = applicant.name.trim().split(/\s+/)[0] || "";
	const html = await render(
		AdmissionsInterviewEmail({
			firstName,
			periodTitle: period.title,
			when: when(interview.startAt),
			room: interview.room,
		}),
	);
	const emailId = await deliverEmail(ctx, {
		periodId: period._id,
		applicationId: application._id,
		kind: "interview_invite",
		key: emailKey,
		to: applicant.email,
		subject: `Intervju for ${period.title}`,
		html,
		text: `Hei ${firstName},\n\nVi vil gjerne invitere deg til intervju for ${period.title}.\nTid: ${when(interview.startAt)}\nSted: ${interview.room}\n\nSvar på denne e-posten hvis tidspunktet ikke passer.`,
	});
	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	const slack = local ? null : admissionsSlack();
	if (slack) {
		if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
		const channel = await ensureAdmissionsChannel(slack, period, interviewers);
		const tags = (await Promise.all(contacts.map((person) => slack.lookupByEmail(person.email))))
			.filter((id): id is string => id !== null)
			.map((id) => `<@${id}>`)
			.join(", ");
		await postAdmissionsNotice(
			slack,
			channel,
			`published:${interview._id}:${interview.revision}`,
			interview._creationTime,
			`Intervju publisert ${when(interview.startAt)} i ${interview.room}. Intervjuere: ${tags}`,
		);
	}
	return { calendarEventId: eventId, deliveryIds: [emailId] };
}

async function sendDecision(ctx: ActionCtx, claimed: CurrentClaim) {
	const { period, application, applicant, job } = claimed;
	if (!application || !applicant) throw new Error("Fant ikke søknaden eller søkeren.");
	if (application.decision !== "accepted" && application.decision !== "rejected")
		throw new Error("Søknaden har ikke et endelig svar.");
	const offer = application.decision === "accepted";
	const kind = offer ? "offer" : "rejection";
	const key = `admission:decision:${application._id}:${application.decisionRevision}:${kind}`;
	const firstName = applicant.name.trim().split(/\s+/)[0] || "";
	const html = await render(
		offer
			? AdmissionsOfferEmail({
					firstName,
					periodTitle: period.title,
					group: application.reviewedGroup ?? application.group ?? "Navet",
					responseUrl: OFFER_URL,
				})
			: AdmissionsRejectionEmail({ firstName, periodTitle: period.title }),
	);
	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	const emailId = await deliverEmail(ctx, {
		periodId: period._id,
		applicationId: application._id,
		kind,
		key,
		to: applicant.email,
		subject: offer
			? `Tilbud om plass i Navet, ${period.title}`
			: `Svar på søknaden til ${period.title}`,
		html,
		text: offer
			? `Hei ${firstName},\n\nVi vil gjerne tilby deg plass i ${application.reviewedGroup ?? application.group ?? "Navet"} gjennom ${period.title}. Logg inn på Hugin for å takke ja eller nei: ${OFFER_URL}`
			: `Hei ${firstName},\n\nTakk for søknaden til ${period.title}. Denne gangen kan vi dessverre ikke tilby deg plass i Navet.`,
	});
	return { deliveryIds: [emailId] };
}

async function remind(ctx: ActionCtx, claimed: CurrentClaim, days: 1 | 3) {
	const { period, application, interview, applicant, interviewers, job } = claimed;
	if (!application || !interview || !applicant || interview.status !== "scheduled")
		throw new Error("Intervjuet finnes ikke lenger eller er avlyst.");
	const kind = days === 3 ? "reminder_3d" : "reminder_1d";
	const key = `admission:interview:${interview._id}:${interview.revision}:reminder-${days}d`;
	const firstName = applicant.name.trim().split(/\s+/)[0] || "";
	const html = await render(
		AdmissionsReminderEmail({
			firstName,
			periodTitle: period.title,
			when: when(interview.startAt),
			room: interview.room,
		}),
	);
	if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
	const emailId = await deliverEmail(ctx, {
		periodId: period._id,
		applicationId: application._id,
		kind,
		key,
		to: applicant.email,
		subject: `Påminnelse om intervju, ${period.title}`,
		html,
		text: `Hei ${firstName},\n\nEn påminnelse om intervjuet ${when(interview.startAt)} i ${interview.room}. Kontakt oss hvis tidspunktet ikke passer.`,
	});
	if (days === 1 && !isLocalDevelopment()) {
		if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
		const slack = admissionsSlack();
		const channel = await ensureAdmissionsChannel(slack, period, interviewers);
		await postAdmissionsNotice(
			slack,
			channel,
			`reminder-1d:${interview._id}:${interview.revision}`,
			interview._creationTime,
			`Påminnelse: intervjuet er ${when(interview.startAt)} i ${interview.room}.`,
		);
	}
	return { deliveryIds: [emailId] };
}

async function cancelInterview(ctx: ActionCtx, claimed: CurrentClaim) {
	const { period, interview, applicant, interviewers, job } = claimed;
	if (!interview) return {};
	const owner = interviewers.find((person) => person.userId === interview.interviewerIds[0]);
	if (interview.calendarEventId && !isLocalDevelopment()) {
		if (!owner) throw new Error("Fant ikke kalenderansvarlig for avlysningen.");
		if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
		const config = googleConfig();
		if (!config)
			throw new Error("Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.");
		await googleCalendarClient(config, owner.email).cancelEvent(
			"primary",
			interview.calendarEventId,
		);
	}
	if (applicant && claimed.application) {
		if (!(await current(ctx, job.idempotencyKey))) throw new StaleAdmissionJob();
		const key = `admission:interview:${interview._id}:${interview.revision}:cancelled`;
		const html = await render(
			AdmissionsCancellationEmail({
				firstName: applicant.name.split(/\s+/)[0] ?? "",
				periodTitle: period.title,
				when: when(interview.startAt),
			}),
		);
		const emailId = await deliverEmail(ctx, {
			periodId: period._id,
			applicationId: claimed.application._id,
			kind: "cancelled",
			key,
			to: applicant.email,
			subject: `Intervjuet er avlyst, ${period.title}`,
			html,
			text: `Intervjuet ${when(interview.startAt)} er avlyst. Vi beklager endringen.`,
		});
		if (!isLocalDevelopment()) {
			const slack = admissionsSlack();
			const channel = await ensureAdmissionsChannel(slack, period, interviewers);
			await postAdmissionsNotice(
				slack,
				channel,
				`cancelled:${interview._id}:${interview.revision}`,
				interview._creationTime,
				`Et intervju i ${period.title} er avlyst. Kalenderinvitasjonen er oppdatert.`,
			);
		}
		return { deliveryIds: [emailId] };
	}
	return {};
}

async function sendDeclineNotice(ctx: ActionCtx, claimed: CurrentClaim, key: string) {
	if (isLocalDevelopment()) return;
	if (!(await current(ctx, key))) throw new StaleAdmissionJob();
	const slack = admissionsSlack();
	const channel = await ensureAdmissionsChannel(slack, claimed.period, claimed.interviewers);
	await postAdmissionsNotice(
		slack,
		channel,
		claimed.job.idempotencyKey,
		claimed.job.createdAt,
		`En søker takket nei til tilbudet fra ${claimed.period.title}. Kandidaten er tilgjengelig for ny vurdering.`,
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
			await sendDeclineNotice(ctx, claimed, key);
			return {};
		case "archive_channel":
			if (!isLocalDevelopment()) {
				if (!(await current(ctx, key))) throw new StaleAdmissionJob();
				await archiveAdmissionsChannel(admissionsSlack(), claimed.period);
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

async function fail(
	ctx: ActionCtx,
	claimed: ClaimedOutbox,
	idempotencyKey: string,
	error: unknown,
) {
	const attempts = claimed.job.attempts + 1;
	await ctx.runMutation(internal.admissions.internal.failOutbox, {
		idempotencyKey,
		error:
			error instanceof Error
				? error.message.slice(0, 500)
				: "Admissions provider operation failed.",
		nextAttemptAt: Date.now() + Math.min(MAX_RETRY, 60_000 * 2 ** Math.min(attempts, 5)),
	});
}

async function process(ctx: ActionCtx, idempotencyKey: string) {
	const claimed = await claim(ctx, idempotencyKey);
	if (!claimed) return;
	if (!claimed.period || !claimed.revisionIsCurrent) {
		await complete(ctx, idempotencyKey);
		return;
	}
	try {
		const result = await runJob(ctx, claimed as CurrentClaim, idempotencyKey);
		await complete(ctx, idempotencyKey, result);
	} catch (error) {
		if (error instanceof StaleAdmissionJob) return await complete(ctx, idempotencyKey);
		await fail(ctx, claimed, idempotencyKey, error);
	}
}

class StaleAdmissionJob extends Error {}

const claim = (ctx: ActionCtx, idempotencyKey: string) =>
	ctx.runMutation(internal.admissions.internal.claimOutbox, { idempotencyKey });

export const processOutbox = internalAction({
	args: { idempotencyKey: v.string() },
	handler: (ctx, { idempotencyKey }) => process(ctx, idempotencyKey),
});

export const notifyDeliveryFailure = internalAction({
	args: {
		periodId: v.id("admissionPeriods"),
		key: v.string(),
		kind: v.string(),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		if (isLocalDevelopment()) return;
		const context = await ctx.runQuery(internal.admissions.delivery.failureContext, {
			periodId: args.periodId,
		});
		if (!context) return;
		const slack = admissionsSlack();
		const channel = await ensureAdmissionsChannel(slack, context.period, context.interviewers);
		await postAdmissionsNotice(
			slack,
			channel,
			args.key,
			Date.now(),
			`En e-postlevering trenger oppfølging (${args.kind}, ${args.status}) for ${context.period.title}. Kontroller opptaksoversikten.`,
		);
	},
});
