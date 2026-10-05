import { MIN_INTERVIEW_NOTICE_MS, overlapsLunch } from "@workspace/shared/admissions";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { coversWindow, localWindow } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../auth/accessRights";
import { accountForUser } from "../iam/accounts";
import { enqueueSystemMessage } from "../iam/notifications";
import { admissionsChannelNames } from "./channelNames";
import {
	activePublishInterviewIds,
	expirePendingOffers,
	finishClose,
	purgeBatch as purgeRecordsBatch,
	queueOutbox,
} from "./lifecycle";
import { MAX_APPLICATIONS, MAX_OUTBOX_ATTEMPTS } from "./rules";

const OUTBOX_LEASE_MS = 5 * 60_000;

async function isCurrent(ctx: Parameters<typeof requireRole>[0], job: Doc<"admissionOutbox">) {
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

async function isCancellationCurrent(
	ctx: Parameters<typeof requireRole>[0],
	job: Doc<"admissionOutbox">,
) {
	const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
	return interview?.status === "cancelled" && interview.revision === job.revision;
}

async function isDeliveryFailureCurrent(
	ctx: Parameters<typeof requireRole>[0],
	job: Doc<"admissionOutbox">,
) {
	const delivery = job.deliveryId ? await ctx.db.get(job.deliveryId) : null;
	return (
		delivery?.periodId === job.periodId &&
		["delayed", "failed", "bounced", "complained"].includes(delivery.status)
	);
}

async function isInterviewJobCurrent(
	ctx: Parameters<typeof requireRole>[0],
	job: Doc<"admissionOutbox">,
	periodStatus: Doc<"admissionPeriods">["status"],
) {
	const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
	if (interview?.status !== "scheduled" || interview.revision !== job.revision) return false;
	return job.kind === "publish"
		? periodStatus === "published"
		: interview.publishedAt !== undefined;
}

async function isApplicationJobCurrent(
	ctx: Parameters<typeof requireRole>[0],
	job: Doc<"admissionOutbox">,
) {
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
	job: Doc<"admissionOutbox">,
	period: Doc<"admissionPeriods"> | null,
	interview: Doc<"admissionInterviews"> | null,
) {
	if (job.kind === "cancel_interview") {
		if (interview?.calendarEventId) return `Google Calendar event ${interview.calendarEventId}`;
		return `Google Calendar interview ${job.interviewId ?? "unknown"}; search shared metadata navetAdmissionsInterviewId=${job.interviewId ?? "unknown"} and navetAdmissionsPeriodId=${job.periodId}`;
	}
	if (!period) return `Slack channel owned by admissions:${job.periodId}`;
	const { name, fallbackName } = admissionsChannelNames(period.applicationStartAt, period._id);
	return `Slack channel ${name} or ${fallbackName}, owner admissions:${period._id}`;
}

export const claimOutbox = internalMutation({
	args: { idempotencyKey: v.string() },
	handler: async (ctx, { idempotencyKey }) => {
		const job = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (!job || job.state === "done" || job.state === "running" || job.nextAttemptAt > Date.now())
			return null;
		const current = await isCurrent(ctx, job);
		if (!current) {
			await ctx.db.patch(job._id, { state: "done", lastError: undefined });
			const period = await ctx.db.get(job.periodId);
			if (period?.status === "closing") await finishClose(ctx, period);
			return null;
		}
		await ctx.db.patch(job._id, {
			state: "running",
			attempts: job.attempts + 1,
			nextAttemptAt: Date.now() + OUTBOX_LEASE_MS,
			lastError: undefined,
		});
		const period = await ctx.db.get(job.periodId);
		const application = job.applicationId ? await ctx.db.get(job.applicationId) : null;
		const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
		const delivery = job.deliveryId ? await ctx.db.get(job.deliveryId) : null;
		const applicantUser = application ? await ctx.db.get(application.userId) : null;
		const interviewerIds =
			job.kind === "sync_channel"
				? (period?.interviewers.map(({ userId }) => userId) ?? [])
				: (interview?.interviewerIds ?? []);
		const selectedInterviewers = await Promise.all(
			(period?.interviewers.map(({ userId }) => userId) ?? []).map(async (userId) => {
				const user = await ctx.db.get(userId);
				return user
					? {
							userId,
							email: await workspaceEmail(ctx, user),
							name: `${user.firstName} ${user.lastName}`.trim(),
						}
					: null;
			}),
		);
		const interviewers = await Promise.all(
			interviewerIds.map(async (userId) => {
				const user = await ctx.db.get(userId);
				return user
					? {
							userId,
							email: await workspaceEmail(ctx, user),
							name: `${user.firstName} ${user.lastName}`.trim(),
						}
					: null;
			}),
		);
		return {
			job: { ...job, state: "running" as const, attempts: job.attempts + 1 },
			period,
			application,
			interview,
			delivery,
			selectedInterviewers: selectedInterviewers.filter(
				(user): user is NonNullable<typeof user> => user !== null,
			),
			applicant:
				application && applicantUser
					? {
							userId: application.userId,
							email: applicantUser.email,
							name: `${applicantUser.firstName} ${applicantUser.lastName}`.trim(),
						}
					: null,
			interviewers: interviewers.filter((user): user is NonNullable<typeof user> => user !== null),
			revisionIsCurrent: true,
		};
	},
});

export const outboxIsCurrent = internalQuery({
	args: { idempotencyKey: v.string() },
	handler: async (ctx, { idempotencyKey }) => {
		const job = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		return job?.state === "running" ? isCurrent(ctx, job) : false;
	},
});

export const completeOutbox = internalMutation({
	args: {
		idempotencyKey: v.string(),
		result: v.optional(
			v.object({
				calendarEventId: v.optional(v.string()),
				deliveryIds: v.optional(v.array(v.string())),
			}),
		),
	},
	handler: async (ctx, { idempotencyKey, result }) => {
		const job = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (!job || job.state === "done") return null;
		const current = await isCurrent(ctx, job);
		await ctx.db.patch(job._id, {
			state: "done",
			result: current ? result : undefined,
			lastError: undefined,
		});
		if (current && job.kind === "publish" && job.interviewId)
			await completePublication(ctx, job, job.interviewId, result);
		if (current && job.kind === "send_decision" && job.applicationId)
			await completeDecision(ctx, job, job.applicationId);
		const period = await ctx.db.get(job.periodId);
		if (period?.status === "closing") await finishClose(ctx, period);
		return { stale: !current };
	},
});

export const failOutbox = internalMutation({
	args: { idempotencyKey: v.string(), error: v.string(), nextAttemptAt: v.number() },
	handler: async (ctx, { idempotencyKey, error, nextAttemptAt }) => {
		const job = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (!job || job.state === "done") return null;
		if (!(await isCurrent(ctx, job))) {
			await ctx.db.patch(job._id, { state: "done", lastError: undefined });
			const period = await ctx.db.get(job.periodId);
			if (period?.status === "closing") await finishClose(ctx, period);
			return { stale: true };
		}
		const exhausted = job.attempts >= MAX_OUTBOX_ATTEMPTS;
		await ctx.db.patch(job._id, { state: "failed", lastError: error.slice(0, 500), nextAttemptAt });
		if (
			exhausted &&
			(job.kind === "cancel_interview" ||
				job.kind === "archive_channel" ||
				job.kind === "offer_declined")
		) {
			const period = await ctx.db.get(job.periodId);
			const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
			await enqueueSystemMessage(ctx, {
				channel: SYSTEM_ALERTS_CHANNEL,
				text: `Admissions integration retry limit reached. Period: ${period?.title ?? job.periodId} (${job.periodId}). Job: ${job.kind}. Resource: ${exhaustedResource(job, period, interview)}. Check provider status and complete cleanup manually if needed.`,
				clientMsgId: `admissions-integration-exhausted:${job._id}`,
			});
		}
		if (!exhausted)
			await ctx.scheduler.runAfter(
				Math.max(0, nextAttemptAt - Date.now()),
				internal.admissions.actions.processOutbox,
				{ idempotencyKey },
			);
		const period = await ctx.db.get(job.periodId);
		if (exhausted && period?.status === "closing") await finishClose(ctx, period);
		return { stale: false, exhausted };
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

export const scheduleContext = internalQuery({
	args: { periodId: v.id("admissionPeriods") },
	handler: async (ctx, { periodId }) => {
		await requireRole(ctx, adminRoles);
		const period = await ctx.db.get(periodId);
		if (!period || period.status === "closing")
			throw new ConvexError("Fant ikke en aktiv opptaksperiode.");
		const applications = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "submitted"),
			)
			.take(MAX_APPLICATIONS + 1);
		if (applications.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange søknader til å lage en plan.");
		const candidates = await Promise.all(
			applications.map(async (application) => {
				const user = await ctx.db.get(application.userId);
				const existingInterview = await ctx.db
					.query("admissionInterviews")
					.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
					.unique();
				return {
					_id: application._id,
					applicationId: application._id,
					userId: application.userId,
					studentProfile: application.studentProfile,
					name: application.studentProfile?.name ?? "",
					email: user?.email ?? "",
					availability: application.availability,
					existingInterview,
				};
			}),
		);
		const interviewers = await Promise.all(
			period.interviewers.map(async (selection) => {
				const user = await ctx.db.get(selection.userId);
				return user
					? {
							userId: user._id,
							name: `${user.firstName} ${user.lastName}`.trim(),
							email: await workspaceEmail(ctx, user),
							selectedCalendarIds: selection.selectedCalendarIds,
						}
					: null;
			}),
		);
		const existingInterviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "scheduled"),
			)
			.take(MAX_APPLICATIONS);
		return {
			period,
			candidates,
			interviewers: interviewers.filter(
				(person): person is NonNullable<typeof person> => person !== null,
			),
			existingInterviews,
		};
	},
});

export const saveSchedule = internalMutation({
	args: {
		periodId: v.id("admissionPeriods"),
		expectedRevision: v.number(),
		assignments: v.array(
			v.object({
				applicationId: v.id("admissionApplications"),
				startAt: v.number(),
				endAt: v.number(),
				interviewerIds: v.array(v.id("users")),
				selectedCalendarIds: v.array(v.string()),
				room: v.string(),
			}),
		),
	},
	handler: async (ctx, { periodId, expectedRevision, assignments }) => {
		const period = await ctx.db.get(periodId);
		if (!period || period.status === "closing" || period.revision !== expectedRevision)
			throw new ConvexError("Opptaket er endret. Last inn på nytt før du lagrer planen.");
		if (
			assignments.length > MAX_APPLICATIONS ||
			new Set(assignments.map((row) => row.applicationId)).size !== assignments.length
		)
			throw new ConvexError("Ugyldig plan.");
		const applications = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "submitted"),
			)
			.take(MAX_APPLICATIONS + 1);
		if (applications.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange søknader til å lagre en plan.");
		const selectionByUser = new Map(
			period.interviewers.map((selection) => [selection.userId, selection]),
		);
		const existingInterviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "scheduled"),
			)
			.take(MAX_APPLICATIONS + 1);
		if (existingInterviews.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange intervjuer i opptaket.");
		const cancelledInterviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "cancelled"),
			)
			.take(MAX_APPLICATIONS + 1);
		if (cancelledInterviews.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange avlyste intervjuer i opptaket.");
		const cancelledApplicationIds = new Set(
			cancelledInterviews.map((interview) => interview.applicationId),
		);
		if (assignments.some((assignment) => cancelledApplicationIds.has(assignment.applicationId)))
			throw new ConvexError(
				"Et avlyst intervju må bookes på nytt manuelt etter avtale med søkeren.",
			);
		const activePublishIds = await activePublishInterviewIds(ctx, periodId);
		const immutable = existingInterviews.filter(
			(interview) => interview.publishedAt !== undefined || activePublishIds.has(interview._id),
		);
		const immutableApplicationIds = new Set(immutable.map((interview) => interview.applicationId));
		const assignmentsByApplication = new Map(
			assignments.map((assignment) => [assignment.applicationId, assignment]),
		);
		for (const interview of immutable) {
			const assignment = assignmentsByApplication.get(interview.applicationId);
			if (assignment && !samePublishedSchedule(assignment, interview, period, selectionByUser))
				throw new ConvexError(
					interview.publishedAt !== undefined
						? "Et publisert intervju må endres gjennom en bekreftet ny plan."
						: "Et intervju kan ikke endres mens kalenderpubliseringen pågår.",
				);
		}
		const eligibility = await Promise.all(
			period.interviewers.map(async ({ userId }) => ({
				userId,
				active: await userHasRole(ctx, userId, internalRoles),
			})),
		);
		const active = new Set(
			eligibility.filter((entry) => entry.active).map((entry) => entry.userId),
		);
		const scheduled = assignments
			.filter((assignment) => !immutableApplicationIds.has(assignment.applicationId))
			.map((assignment) =>
				validateAssignment(assignment, period, applications, selectionByUser, active),
			);
		const pinned = immutable.map((interview) => ({
			applicationId: interview.applicationId,
			startAt: interview.startAt,
			endAt: interview.endAt,
			interviewerIds: interview.interviewerIds,
			room: interview.room,
		}));
		assertNoScheduleConflicts([...pinned, ...scheduled], period.buffer, pinned.length);
		const saved = await Promise.all(
			scheduled.map(async (assignment) => {
				const previous = await ctx.db
					.query("admissionInterviews")
					.withIndex("by_applicationId", (q) => q.eq("applicationId", assignment.applicationId))
					.unique();
				const fields = {
					periodId,
					...assignment,
					selectedCalendarIds: [
						...new Set(
							assignment.interviewerIds.flatMap(
								(id) => selectionByUser.get(id)?.selectedCalendarIds ?? [],
							),
						),
					],
					status: "scheduled" as const,
					revision: (previous?.revision ?? 0) + 1,
					calendarEventId: previous?.calendarEventId,
					publishedAt: undefined,
				};
				if (previous) await ctx.db.replace(previous._id, fields);
				else await ctx.db.insert("admissionInterviews", fields);
				return assignment.applicationId;
			}),
		);
		await ctx.db.patch(periodId, {
			status: scheduled.length > 0 ? "open" : period.status,
			revision: period.revision + 1,
		});
		const assigned = [...immutable.map((interview) => interview.applicationId), ...saved];
		return { count: assigned.length, unmatched: applicationsNotScheduled(applications, assigned) };
	},
});

function applicationsNotScheduled(
	applications: Doc<"admissionApplications">[],
	scheduled: Id<"admissionApplications">[],
) {
	const assigned = new Set(scheduled);
	return applications
		.filter((application) => !assigned.has(application._id))
		.map((application) => application._id);
}

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
		const now = Date.now();
		const applications = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "submitted"),
			)
			.take(MAX_APPLICATIONS);
		const interviewsBeingPublished = await activePublishInterviewIds(ctx, periodId);
		await expirePendingOffers(ctx, applications);
		const interviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "scheduled"),
			)
			.take(MAX_APPLICATIONS);
		await Promise.all(
			interviews.map(async (interview) => {
				if (
					interview.calendarEventId ||
					interview.publishedAt ||
					interviewsBeingPublished.has(interview._id)
				) {
					const revision = interview.revision + 1;
					await ctx.db.patch(interview._id, {
						status: "cancelled",
						revision,
						publishedAt: undefined,
					});
					await queueOutbox(ctx, {
						kind: "cancel_interview",
						periodId,
						applicationId: interview.applicationId,
						interviewId: interview._id,
						revision,
						idempotencyKey: `retention-cancel:${interview._id}:${revision}`,
						state: "pending",
						attempts: 0,
						nextAttemptAt: now,
						createdAt: now,
						notifyApplicant: Boolean(interview.publishedAt && interview.startAt > now),
					});
				} else
					await ctx.db.patch(interview._id, {
						status: "cancelled",
						revision: interview.revision + 1,
					});
			}),
		);
		const closing = { ...period, status: "closing" as const, revision: period.revision + 1 };
		await ctx.db.patch(periodId, { status: "closing", revision: closing.revision });
		await finishClose(ctx, closing);
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
	job: Doc<"admissionOutbox">,
	interviewId: Id<"admissionInterviews">,
	result: Doc<"admissionOutbox">["result"],
) {
	const interview = await ctx.db.get(interviewId);
	if (interview?.revision === job.revision && interview.status === "scheduled") {
		await ctx.db.patch(interview._id, {
			calendarEventId: result?.calendarEventId ?? interview.calendarEventId,
			publishedAt: Date.now(),
		});
		await Promise.all(
			(
				[
					["remind_3d", 3 * 86400000],
					["remind_1d", 86400000],
				] as const
			).map(async ([kind, offset]) => {
				const nextAttemptAt = interview.startAt - offset;
				if (nextAttemptAt > Date.now())
					await queueOutbox(ctx, {
						kind,
						periodId: interview.periodId,
						applicationId: interview.applicationId,
						interviewId: interview._id,
						revision: interview.revision,
						idempotencyKey: `${kind}:${interview._id}:${interview.revision}`,
						state: "pending",
						attempts: 0,
						nextAttemptAt,
						createdAt: Date.now(),
					});
			}),
		);
	}
}

async function completeDecision(
	ctx: MutationCtx,
	job: Doc<"admissionOutbox">,
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

type ScheduleAssignment = Pick<
	Doc<"admissionInterviews">,
	"applicationId" | "startAt" | "endAt" | "interviewerIds" | "selectedCalendarIds" | "room"
>;
function validateAssignment(
	assignment: ScheduleAssignment,
	period: Doc<"admissionPeriods">,
	applications: Doc<"admissionApplications">[],
	selectionByUser: Map<Id<"users">, Doc<"admissionPeriods">["interviewers"][number]>,
	active: Set<Id<"users">>,
) {
	const application = applications.find((entry) => entry._id === assignment.applicationId);
	if (!application || application.periodId !== period._id || application.status !== "submitted")
		throw new ConvexError("En søknad i planen finnes ikke lenger.");
	const interviewerIds = [...new Set(assignment.interviewerIds)];
	if (interviewerIds.length !== 2 || interviewerIds.length !== assignment.interviewerIds.length)
		throw new ConvexError("Hvert intervju må ha nøyaktig to ulike intervjuere.");
	if (interviewerIds.some((userId) => !selectionByUser.has(userId) || !active.has(userId)))
		throw new ConvexError("En intervjuer er ikke lenger valgt eller aktiv.");
	validateAssignmentTime(assignment, period, application);
	const selected = [
		...new Set(
			interviewerIds.flatMap((userId) => selectionByUser.get(userId)?.selectedCalendarIds ?? []),
		),
	].sort((a, b) => a.localeCompare(b));
	if (
		selected.some((calendarId) => !assignment.selectedCalendarIds.includes(calendarId)) ||
		assignment.selectedCalendarIds.some((calendarId) => !selected.includes(calendarId))
	)
		throw new ConvexError("Kalendervalgene har endret seg. Oppdater planen.");
	const room = assignment.room.trim() || period.room;
	return {
		applicationId: assignment.applicationId,
		startAt: assignment.startAt,
		endAt: assignment.endAt,
		interviewerIds,
		room,
	};
}
function assertNoScheduleConflicts(
	scheduled: Omit<ScheduleAssignment, "selectedCalendarIds">[],
	buffer: number,
	fixedCount = 0,
) {
	const conflict = scheduled.some((assignment, index) =>
		scheduled.slice(index + 1).some((other, nextIndex) => {
			const otherIndex = index + 1 + nextIndex;
			if (index < fixedCount && otherIndex < fixedCount) return false;
			return (
				other.startAt < assignment.endAt + buffer * 60_000 &&
				assignment.startAt < other.endAt + buffer * 60_000 &&
				(other.room === assignment.room ||
					other.interviewerIds.some((id) => assignment.interviewerIds.includes(id)))
			);
		}),
	);
	if (conflict) throw new ConvexError("Intervjuer eller rom er allerede opptatt i denne tiden.");
}

function samePublishedSchedule(
	assignment: ScheduleAssignment,
	interview: Doc<"admissionInterviews">,
	period: Doc<"admissionPeriods">,
	selectionByUser: Map<Id<"users">, Doc<"admissionPeriods">["interviewers"][number]>,
) {
	const interviewerIds = [...assignment.interviewerIds].sort((a, b) =>
		String(a).localeCompare(String(b)),
	);
	const existingInterviewerIds = [...interview.interviewerIds].sort((a, b) =>
		String(a).localeCompare(String(b)),
	);
	const calendarIds = [
		...new Set(
			assignment.interviewerIds.flatMap(
				(userId) => selectionByUser.get(userId)?.selectedCalendarIds ?? [],
			),
		),
	].sort((a, b) => a.localeCompare(b));
	const room = assignment.room.trim() || period.room;
	return (
		assignment.startAt === interview.startAt &&
		assignment.endAt === interview.endAt &&
		room === interview.room &&
		interviewerIds.length === existingInterviewerIds.length &&
		interviewerIds.every((userId, index) => userId === existingInterviewerIds[index]) &&
		calendarIds.length === interview.selectedCalendarIds.length &&
		calendarIds.every((id) => interview.selectedCalendarIds.includes(id))
	);
}

function validateAssignmentTime(
	assignment: ScheduleAssignment,
	period: Doc<"admissionPeriods">,
	application: Doc<"admissionApplications">,
) {
	const duration = (assignment.endAt - assignment.startAt) / 60_000;
	if (assignment.startAt < Date.now() + MIN_INTERVIEW_NOTICE_MS)
		throw new ConvexError("Nye intervjuer må planlegges minst 48 timer fram i tid.");
	if (
		!Number.isInteger(duration) ||
		duration !== period.duration ||
		assignment.startAt < period.interviewStartAt ||
		assignment.endAt > period.interviewEndAt
	)
		throw new ConvexError("Et intervju ligger utenfor perioden eller har feil varighet.");
	const window = localWindow(assignment.startAt, duration, period.timezone);
	const meeting = { ...window, end: window.start + duration + period.buffer };
	if (
		meeting.start < period.dayStart ||
		meeting.end > period.dayEnd ||
		(period.lunch && overlapsLunch(meeting)) ||
		period.breaks.some(
			(pause) =>
				pause.day === meeting.day && pause.start < meeting.end && meeting.start < pause.end,
		)
	)
		throw new ConvexError("Et intervju kolliderer med arbeidstid eller pause.");
	if (!coversWindow(application.availability, meeting))
		throw new ConvexError("En søker er ikke tilgjengelig på tildelt tidspunkt.");
}

async function workspaceEmail(ctx: Parameters<typeof accountForUser>[0], user: Doc<"users">) {
	return (await accountForUser(ctx, user._id, user.email))?.workspaceEmail ?? user.email;
}
