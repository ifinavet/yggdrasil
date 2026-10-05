import { admissionsChannelNames, SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../auth/accessRights";
import { workspaceEmail } from "../iam/accounts";
import { enqueueSystemMessage } from "../iam/notifications";
import { isEmailDeliveryFailure } from "../lib/emailDelivery";
import { type Operation, startDelivery } from "./delivery/workflow";
import { beginClose, purgeBatch as purgeRecordsBatch } from "./lifecycle";
import { operationValidator } from "./schema";

async function isCurrent(ctx: Parameters<typeof requireRole>[0], job: Operation) {
	const period = await ctx.db.get(job.periodId);
	if (job.kind === "archive_channel") return period?.status === "closing";
	if (!period) return false;
	if (job.kind === "sync_channel") return period.status !== "closing";
	if (job.kind === "cancel_interview") return isCancellationCurrent(ctx, job);
	if (job.kind === "offer_declined") return isApplicationJobCurrent(ctx, job);
	if (period.status === "closing") return false;
	if (job.kind === "delivery_failure") return isDeliveryFailureCurrent(ctx, job);
	if (job.kind === "publish" || job.kind === "remind_3d" || job.kind === "remind_1d")
		return isInterviewJobCurrent(ctx, job, period.status);
	return isApplicationJobCurrent(ctx, job);
}

async function isCancellationCurrent(ctx: Parameters<typeof requireRole>[0], job: Operation) {
	const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
	return interview?.status === "cancelled" && interview.revision === job.revision;
}

async function isDeliveryFailureCurrent(ctx: Parameters<typeof requireRole>[0], job: Operation) {
	const delivery = job.deliveryId ? await ctx.db.get(job.deliveryId) : null;
	return delivery?.periodId === job.periodId && isEmailDeliveryFailure(delivery.status);
}

async function isInterviewJobCurrent(
	ctx: Parameters<typeof requireRole>[0],
	job: Operation,
	periodStatus: Doc<"admissionPeriods">["status"],
) {
	const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
	if (interview?.status !== "scheduled" || interview.revision !== job.revision) return false;
	return job.kind === "publish"
		? periodStatus === "published"
		: interview.publishedAt !== undefined;
}

async function isApplicationJobCurrent(ctx: Parameters<typeof requireRole>[0], job: Operation) {
	const application = job.applicationId ? await ctx.db.get(job.applicationId) : null;
	if (!application) return false;
	if (job.kind === "send_decision")
		return (
			application.decisionQueuedAt !== undefined && application.decisionRevision === job.revision
		);
	if (job.kind === "offer_declined")
		return application.offerStatus === "declined" && application.decisionRevision === job.revision;
	return false;
}

function exhaustedResource(
	job: Operation,
	period: Doc<"admissionPeriods"> | null,
	interview: Doc<"admissionInterviews"> | null,
) {
	if (job.kind === "cancel_interview" || job.kind === "publish") {
		if (interview?.calendarEventId) return `Google Calendar event ${interview.calendarEventId}`;
		return `Google Calendar interview ${job.interviewId ?? "unknown"}; search shared metadata navetAdmissionsInterviewId=${job.interviewId ?? "unknown"} and navetAdmissionsPeriodId=${job.periodId}`;
	}
	if (job.kind === "send_decision" || job.kind === "remind_3d" || job.kind === "remind_1d")
		return `Email delivery ${job.idempotencyKey}`;
	if (!period) return `Slack channel owned by admissions:${job.periodId}`;
	const { name, fallbackName } = admissionsChannelNames(period.applicationStartAt, period._id);
	return `Slack channel ${name} or ${fallbackName}, owner admissions:${period._id}`;
}

export const deliveryContext = internalQuery({
	args: { operation: operationValidator },
	handler: async (ctx, { operation: job }) => {
		if (!(await isCurrent(ctx, job))) return null;
		const period = await ctx.db.get(job.periodId);
		const application = job.applicationId ? await ctx.db.get(job.applicationId) : null;
		const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
		const delivery = job.deliveryId ? await ctx.db.get(job.deliveryId) : null;
		const applicantUser = application ? await ctx.db.get(application.userId) : null;
		const interviewerIds =
			job.kind === "sync_channel"
				? (period?.interviewers.map(({ userId }) => userId) ?? [])
				: (interview?.interviewerIds ?? []);
		const selectedIds = period?.interviewers.map(({ userId }) => userId) ?? [];
		const people = (
			await Promise.all(
				[...new Set([...selectedIds, ...interviewerIds])].map(async (userId) => {
					const user = await ctx.db.get(userId);
					return user && !user.deleted
						? {
								userId,
								email: await workspaceEmail(ctx, user),
								name: `${user.firstName} ${user.lastName}`.trim(),
							}
						: null;
				}),
			)
		).filter((user) => user !== null);
		return {
			job,
			period,
			application,
			interview,
			delivery,
			selectedInterviewers: people.filter((person) => selectedIds.includes(person.userId)),
			applicant:
				application && applicantUser
					? {
							userId: application.userId,
							email: applicantUser.email,
							name: `${applicantUser.firstName} ${applicantUser.lastName}`.trim(),
						}
					: null,
			interviewers: people.filter((person) => interviewerIds.includes(person.userId)),
		};
	},
});

export const operationIsCurrent = internalQuery({
	args: { operation: operationValidator },
	handler: (ctx, { operation }) => isCurrent(ctx, operation),
});

export const completeDelivery = internalMutation({
	args: { operation: operationValidator, calendarEventId: v.optional(v.string()) },
	handler: async (ctx, { operation: job, calendarEventId }) => {
		if (!(await isCurrent(ctx, job))) return { stale: true };
		if (job.kind === "publish" && job.interviewId)
			await completePublication(ctx, job, job.interviewId, calendarEventId);
		if (job.kind === "send_decision" && job.applicationId)
			await completeDecision(ctx, job, job.applicationId);
		return { stale: false };
	},
});

export const reportFailure = internalMutation({
	args: { operation: operationValidator },
	handler: async (ctx, { operation: job }) => {
		if (!(await isCurrent(ctx, job))) return;
		const period = await ctx.db.get(job.periodId);
		const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
		await enqueueSystemMessage(ctx, {
			channel: SYSTEM_ALERTS_CHANNEL,
			text: `Admissions integration retry limit reached. Period: ${period?.title ?? job.periodId} (${job.periodId}). Job: ${job.kind}. Resource: ${exhaustedResource(job, period, interview)}. Check provider status and complete cleanup manually if needed.`,
			clientMsgId: `admissions-integration-exhausted:${job.idempotencyKey}`,
		});
	},
});

export const calendarAccess = internalQuery({
	args: { periodId: v.id("admissionPeriods"), interviewerId: v.id("users") },
	handler: async (ctx, { periodId, interviewerId }) => {
		await requireRole(ctx, adminRoles);
		const period = await ctx.db.get(periodId);
		if (!period || period.status === "closing") throw new ConvexError("Fant ikke opptaksperioden.");
		const interviewer = period.interviewers.find((item) => item.userId === interviewerId);
		if (!interviewer || !(await userHasRole(ctx, interviewerId, internalRoles)))
			throw new ConvexError("Intervjueren er ikke valgt i denne perioden.");
		const user = await ctx.db.get(interviewerId);
		return { period, interviewer, email: user ? await workspaceEmail(ctx, user) : "" };
	},
});

export const saveSlackManagedMembers = internalMutation({
	args: {
		periodId: v.id("admissionPeriods"),
		expectedRevision: v.number(),
		memberIds: v.array(v.string()),
	},
	handler: async (ctx, { periodId, expectedRevision, memberIds }) => {
		const members = [...new Set(memberIds)];
		if (members.length > 60 || members.some((member) => !member))
			throw new ConvexError("Medlemslisten for opptakskanalen er ugyldig.");
		const period = await ctx.db.get(periodId);
		if (!period || (period.status !== "closing" && period.revision !== expectedRevision))
			throw new ConvexError("Opptaket ble endret mens Slack-kanalen ble oppdatert.");
		await ctx.db.patch(periodId, { slackManagedMemberIds: members });
	},
});

export const purgeBatch = internalMutation({
	args: { periodId: v.id("admissionPeriods") },
	handler: async (ctx, { periodId }) => {
		const period = await ctx.db.get(periodId);
		if (period?.status !== "closing") return false;
		return await purgeRecordsBatch(ctx, periodId);
	},
});

export const closeExpiredPeriod = internalMutation({
	args: { periodId: v.id("admissionPeriods") },
	handler: async (ctx, { periodId }) => {
		const period = await ctx.db.get(periodId);
		if (!period || period.status === "closing") return false;
		await beginClose(ctx, period, true, `retention:${periodId}`);
		return true;
	},
});

export const expireOffer = internalMutation({
	args: {
		applicationId: v.id("admissionApplications"),
		decisionRevision: v.number(),
	},
	handler: async (ctx, { applicationId, decisionRevision }) => {
		const application = await ctx.db.get(applicationId);
		if (
			!application ||
			application.decisionRevision !== decisionRevision ||
			application.offerStatus !== "pending" ||
			application.offerDeadline === undefined ||
			application.offerDeadline > Date.now()
		)
			return false;
		await ctx.db.patch(applicationId, {
			offerStatus: "expired",
			revision: application.revision + 1,
		});
		return true;
	},
});

async function completePublication(
	ctx: MutationCtx,
	job: Operation,
	interviewId: Id<"admissionInterviews">,
	calendarEventId: string | undefined,
) {
	const interview = await ctx.db.get(interviewId);
	if (interview?.revision === job.revision && interview.status === "scheduled") {
		await ctx.db.patch(interview._id, {
			calendarEventId: calendarEventId ?? interview.calendarEventId,
			publishedAt: Date.now(),
		});
		await Promise.all(
			(
				[
					["remind_3d", 3 * 86400000],
					["remind_1d", 86400000],
				] as const
			).map(async ([kind, offset]) => {
				const dueAt = interview.startAt - offset;
				if (dueAt > Date.now())
					await startDelivery(ctx, {
						kind,
						periodId: interview.periodId,
						applicationId: interview.applicationId,
						interviewId: interview._id,
						revision: interview.revision,
						idempotencyKey: `${kind}:${interview._id}:${interview.revision}`,
						dueAt,
					});
			}),
		);
	}
}

async function completeDecision(
	ctx: MutationCtx,
	job: Operation,
	applicationId: Id<"admissionApplications">,
) {
	const application = await ctx.db.get(applicationId);
	const currentPeriod = await ctx.db.get(job.periodId);
	if (
		application &&
		currentPeriod &&
		application.decisionRevision === job.revision &&
		!application.decisionSentAt
	) {
		const decisionSentAt = Date.now();
		let offerDeadline: number | undefined;
		let offerStatus: Doc<"admissionApplications">["offerStatus"] = "none";
		if (application.decision === "accepted") {
			offerDeadline = Math.min(currentPeriod.retentionAt, decisionSentAt + 7 * 86400000);
			offerStatus = offerDeadline <= decisionSentAt ? "expired" : "pending";
		}
		await ctx.db.patch(application._id, {
			decisionQueuedAt: undefined,
			decisionSentAt,
			sent: true,
			offerStatus,
			offerDeadline,
			revision: application.revision + 1,
		});
		if (offerStatus === "pending" && offerDeadline !== undefined)
			await ctx.scheduler.runAt(offerDeadline, internal.admissions.internal.expireOffer, {
				applicationId: application._id,
				decisionRevision: job.revision,
			});
	}
}
