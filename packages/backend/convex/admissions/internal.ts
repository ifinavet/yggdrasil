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
import { beginClose, finishClose, purgeBatch as purgeRecordsBatch } from "./lifecycle";
import { operationValidator } from "./schema";

async function currentResources(ctx: Parameters<typeof requireRole>[0], job: Operation) {
	const period = await ctx.db.get(job.periodId);
	if (!period) return null;
	if (
		period.status === "closing" &&
		!["archive_channel", "cancel_interview", "offer_declined"].includes(job.kind)
	)
		return null;
	const application = job.applicationId ? await ctx.db.get(job.applicationId) : null;
	const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
	const delivery = job.deliveryId ? await ctx.db.get(job.deliveryId) : null;
	const scheduled = interview?.status === "scheduled" && interview.revision === job.revision;
	const reminder = scheduled && interview?.publishedAt !== undefined;
	const decisionCurrent = application?.decisionRevision === job.revision;
	const current = {
		archive_channel: period.status === "closing",
		sync_channel: period.status !== "closing",
		cancel_interview: interview?.status === "cancelled" && interview.revision === job.revision,
		delivery_failure:
			delivery?.periodId === job.periodId && isEmailDeliveryFailure(delivery.status),
		publish: scheduled && (period.status === "published" || job.rescheduled === true),
		remind_3d: reminder,
		remind_1d: reminder,
		send_decision: decisionCurrent && application?.decisionQueuedAt !== undefined,
		offer_declined: decisionCurrent && application?.offerStatus === "declined",
	}[job.kind];
	return current ? { period, application, interview, delivery } : null;
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
		const resources = await currentResources(ctx, job);
		if (!resources) return null;
		const { period, application, interview, delivery } = resources;
		const applicantUser = application ? await ctx.db.get(application.userId) : null;
		const interviewerIds =
			job.kind === "sync_channel"
				? period.interviewers.map(({ userId }) => userId)
				: (interview?.interviewerIds ?? []);
		const selectedIds = period.interviewers.map(({ userId }) => userId);
		const ownerIds = interview?.calendarOwnerId ? [interview.calendarOwnerId] : [];
		const people = (
			await Promise.all(
				[...new Set([...selectedIds, ...interviewerIds, ...ownerIds])].map(async (userId) => {
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
			calendarOwner: people.find((person) => person.userId === interview?.calendarOwnerId) ?? null,
		};
	},
});

export const operationIsCurrent = internalQuery({
	args: { operation: operationValidator },
	handler: async (ctx, { operation }) => (await currentResources(ctx, operation)) !== null,
});

export const completeDelivery = internalMutation({
	args: {
		operation: operationValidator,
		calendarEventId: v.optional(v.string()),
		calendarOwnerId: v.optional(v.id("users")),
	},
	handler: async (ctx, { operation: job, calendarEventId, calendarOwnerId }) => {
		const resources = await currentResources(ctx, job);
		if (!resources) return { stale: true };
		if (job.kind === "publish" && resources.interview)
			await completePublication(ctx, resources.interview, calendarEventId, calendarOwnerId);
		if (job.kind === "send_decision" && resources.application)
			await completeDecision(ctx, resources.application, resources.period);
		return { stale: false };
	},
});

export const reportFailure = internalMutation({
	args: { operation: operationValidator },
	handler: async (ctx, { operation: job }) => {
		const resources = await currentResources(ctx, job);
		if (!resources) return;
		const { period, interview } = resources;
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
		if (!period) return false;
		if (period.status === "closing") {
			if (Date.now() < period.retentionAt) return false;
			return await finishClose(ctx, period);
		}
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
	interview: Doc<"admissionInterviews">,
	calendarEventId: string | undefined,
	calendarOwnerId: Id<"users"> | undefined,
) {
	await ctx.db.patch(interview._id, {
		calendarEventId: calendarEventId ?? interview.calendarEventId,
		calendarOwnerId: calendarOwnerId ?? interview.calendarOwnerId,
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

async function completeDecision(
	ctx: MutationCtx,
	application: Doc<"admissionApplications">,
	currentPeriod: Doc<"admissionPeriods">,
) {
	if (application.decisionSentAt) return;
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
		offerStatus,
		offerDeadline,
		revision: application.revision + 1,
	});
	if (offerStatus === "pending" && offerDeadline !== undefined)
		await ctx.scheduler.runAt(offerDeadline, internal.admissions.internal.expireOffer, {
			applicationId: application._id,
			decisionRevision: application.decisionRevision,
		});
}
