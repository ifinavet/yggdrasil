import { MIN_INTERVIEW_NOTICE_MS } from "@workspace/shared/admissions";
import { admissionsChannelNames, SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../auth/accessRights";
import { accountForUser } from "../iam/accounts";
import { enqueueSystemMessage } from "../iam/notifications";
import { isEmailDeliveryFailure } from "../lib/emailDelivery";
import { type Operation, startDelivery } from "./delivery/workflow";
import {
	activePublishInterviewIds,
	beginClose,
	purgeBatch as purgeRecordsBatch,
} from "./lifecycle";
import {
	interviewCalendarIds,
	MAX_APPLICATIONS,
	sameInterviewSchedule,
	validateInterviewWindow,
} from "./rules";
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
				const existingInterview = await ctx.db
					.query("admissionInterviews")
					.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
					.unique();
				return {
					applicationId: application._id,
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
				candidateConfirmedOutsideForm: v.optional(v.boolean()),
				confirmPublishedReschedule: v.optional(v.boolean()),
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

		const result = await commitSchedule(ctx, period, applications, assignments);
		const assigned = result.assigned;
		return { count: assigned.length, unmatched: applicationsNotScheduled(applications, assigned) };
	},
});

export async function commitSchedule(
	ctx: MutationCtx,
	period: Doc<"admissionPeriods">,
	applications: Doc<"admissionApplications">[],
	assignments: ScheduleAssignment[],
	updatedBy?: Id<"users">,
) {
	const previous = await ctx.db
		.query("admissionInterviews")
		.withIndex("by_periodId_and_status", (q) => q.eq("periodId", period._id))
		.take(MAX_APPLICATIONS + 1);
	if (previous.length > MAX_APPLICATIONS) throw new ConvexError("For mange intervjuer i opptaket.");
	const publishing = await activePublishInterviewIds(ctx, period._id);
	const eligibility = await Promise.all(
		period.interviewers.map(async ({ userId }) => ({
			userId,
			active: await userHasRole(ctx, userId, internalRoles),
		})),
	);
	const active = new Set(eligibility.filter((item) => item.active).map((item) => item.userId));
	const changes = assignments.flatMap((assignment) => {
		const before = previous.find(
			(interview) => interview.applicationId === assignment.applicationId,
		);

		const selectedCalendarIds = interviewCalendarIds(period, assignment.interviewerIds);
		if (
			selectedCalendarIds.some((id) => !assignment.selectedCalendarIds.includes(id)) ||
			assignment.selectedCalendarIds.some((id) => !selectedCalendarIds.includes(id))
		)
			throw new ConvexError("Kalendervalgene må komme fra periodens oppsett. Oppdater planen.");
		const desired = {
			...assignment,
			selectedCalendarIds,
			room: assignment.room.trim() || period.room,
		};
		if (before?.status === "scheduled" && sameInterviewSchedule(before, desired)) return [];
		validateScheduleEdit(before, desired, publishing);
		const normalized = validateAssignment(
			desired,
			period,
			applications,
			active,
			assignment.candidateConfirmedOutsideForm,
		);
		return [
			{
				...normalized,
				periodId: period._id,
				status: "scheduled" as const,
				revision: (before?.revision ?? 0) + 1,
				calendarEventId: before?.calendarEventId,
				publishedAt: undefined,
				candidateConfirmedOutsideForm: assignment.candidateConfirmedOutsideForm || undefined,
			},
		];
	});
	const fixed = previous.filter(
		(interview) =>
			interview.status === "scheduled" &&
			!changes.some((item) => item.applicationId === interview.applicationId),
	);
	assertNoScheduleConflicts([...fixed, ...changes], period.buffer, fixed.length);
	await Promise.all(
		changes.map(async (fields) => {
			const before = previous.find((interview) => interview.applicationId === fields.applicationId);
			if (before) await ctx.db.replace(before._id, fields);
			else await ctx.db.insert("admissionInterviews", fields);
			const application = applications.find((item) => item._id === fields.applicationId);
			if (application) await ctx.db.patch(application._id, { revision: application.revision + 1 });
		}),
	);
	await ctx.db.patch(period._id, {
		status: changes.length ? "open" : period.status,
		revision: period.revision + 1,
		...(updatedBy && { updatedBy }),
	});
	return {
		assigned: [
			...fixed.map((item) => item.applicationId),
			...changes.map((item) => item.applicationId),
		],
		changes,
	};
}

function validateScheduleEdit(
	previous: Doc<"admissionInterviews"> | undefined,
	desired: ScheduleAssignment,
	publishing: Set<Id<"admissionInterviews">>,
) {
	if (previous && publishing.has(previous._id))
		throw new ConvexError("Intervjuet publiseres nå. Vent før du endrer planen.");
	if (previous?.status === "cancelled" && !desired.candidateConfirmedOutsideForm)
		throw new ConvexError(
			"Bekreft at søkeren har avtalt et nytt tidspunkt før et avlyst intervju bookes på nytt.",
		);
	if (desired.startAt < Date.now() + MIN_INTERVIEW_NOTICE_MS)
		throw new ConvexError("Nye intervjuer må planlegges minst 48 timer fram i tid.");
	if (previous?.publishedAt && !desired.confirmPublishedReschedule)
		throw new ConvexError("Bekreft endring av det publiserte intervjuet før du lagrer.");
}

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

type ScheduleAssignment = Pick<
	Doc<"admissionInterviews">,
	"applicationId" | "startAt" | "endAt" | "interviewerIds" | "selectedCalendarIds" | "room"
> & { candidateConfirmedOutsideForm?: boolean; confirmPublishedReschedule?: boolean };
function validateAssignment(
	assignment: ScheduleAssignment,
	period: Doc<"admissionPeriods">,
	applications: Doc<"admissionApplications">[],
	active: Set<Id<"users">>,
	confirmedOutsideForm = false,
) {
	const application = applications.find((entry) => entry._id === assignment.applicationId);
	if (!application || application.periodId !== period._id || application.status !== "submitted")
		throw new ConvexError("En søknad i planen finnes ikke lenger.");
	const interviewerIds = [...new Set(assignment.interviewerIds)];
	if (interviewerIds.length !== 2 || interviewerIds.length !== assignment.interviewerIds.length)
		throw new ConvexError("Velg nøyaktig to ulike intervjuere.");
	if (interviewerIds.some((userId) => !active.has(userId)))
		throw new ConvexError("En intervjuer er ikke lenger valgt eller aktiv.");
	if ((assignment.endAt - assignment.startAt) / 60000 !== period.duration)
		throw new ConvexError("Et intervju ligger utenfor perioden eller har feil varighet.");
	validateInterviewWindow(assignment.startAt, period, application, confirmedOutsideForm);
	const room = assignment.room.trim() || period.room;
	return {
		applicationId: assignment.applicationId,
		startAt: assignment.startAt,
		endAt: assignment.endAt,
		interviewerIds,
		selectedCalendarIds: assignment.selectedCalendarIds,
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

async function workspaceEmail(ctx: Parameters<typeof accountForUser>[0], user: Doc<"users">) {
	return (await accountForUser(ctx, user._id, user.email))?.workspaceEmail ?? user.email;
}
