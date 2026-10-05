import { MIN_INTERVIEW_NOTICE_MS } from "@workspace/shared/admissions";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
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
import { type Operation, startDelivery } from "./workflow";

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
	return (
		delivery?.periodId === job.periodId &&
		["delayed", "failed", "bounced", "complained"].includes(delivery.status)
	);
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
	if (job.kind === "cancel_interview") {
		if (interview?.calendarEventId) return `Google Calendar event ${interview.calendarEventId}`;
		return `Google Calendar interview ${job.interviewId ?? "unknown"}; search shared metadata navetAdmissionsInterviewId=${job.interviewId ?? "unknown"} and navetAdmissionsPeriodId=${job.periodId}`;
	}
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

export const deliveryResult = v.object({
	calendarEventId: v.optional(v.string()),
	deliveryIds: v.optional(v.array(v.string())),
});
type DeliveryResult = { calendarEventId?: string; deliveryIds?: string[] };
export const completeDelivery = internalMutation({
	args: { operation: operationValidator, result: v.optional(deliveryResult) },
	handler: async (ctx, { operation: job, result }) => {
		if (!(await isCurrent(ctx, job))) return { stale: true };
		if (job.kind === "publish" && job.interviewId)
			await completePublication(ctx, job, job.interviewId, result);
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
			if (
				assignment &&
				!sameInterviewSchedule(interview, {
					...assignment,
					room: assignment.room.trim() || period.room,
					selectedCalendarIds: interviewCalendarIds(period, assignment.interviewerIds),
				})
			)
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
			.map((assignment) => validateAssignment(assignment, period, applications, active));
		assertNoScheduleConflicts([...immutable, ...scheduled], period.buffer, immutable.length);
		const saved = await Promise.all(
			scheduled.map(async (assignment) => {
				const previous = await ctx.db
					.query("admissionInterviews")
					.withIndex("by_applicationId", (q) => q.eq("applicationId", assignment.applicationId))
					.unique();
				const fields = {
					periodId,
					...assignment,
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
	result: DeliveryResult | undefined,
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
>;
function validateAssignment(
	assignment: ScheduleAssignment,
	period: Doc<"admissionPeriods">,
	applications: Doc<"admissionApplications">[],
	active: Set<Id<"users">>,
) {
	const application = applications.find((entry) => entry._id === assignment.applicationId);
	if (!application || application.periodId !== period._id || application.status !== "submitted")
		throw new ConvexError("En søknad i planen finnes ikke lenger.");
	const interviewerIds = [...new Set(assignment.interviewerIds)];
	if (interviewerIds.length !== 2 || interviewerIds.length !== assignment.interviewerIds.length)
		throw new ConvexError("Hvert intervju må ha nøyaktig to ulike intervjuere.");
	if (interviewerIds.some((userId) => !active.has(userId)))
		throw new ConvexError("En intervjuer er ikke lenger valgt eller aktiv.");
	validateAssignmentTime(assignment, period, application);
	const selected = interviewCalendarIds(period, interviewerIds);
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
		selectedCalendarIds: selected,
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

function validateAssignmentTime(
	assignment: ScheduleAssignment,
	period: Doc<"admissionPeriods">,
	application: Doc<"admissionApplications">,
) {
	const duration = (assignment.endAt - assignment.startAt) / 60_000;
	if (assignment.startAt < Date.now() + MIN_INTERVIEW_NOTICE_MS)
		throw new ConvexError("Nye intervjuer må planlegges minst 48 timer fram i tid.");
	if (!Number.isInteger(duration) || duration !== period.duration)
		throw new ConvexError("Et intervju ligger utenfor perioden eller har feil varighet.");
	validateInterviewWindow(assignment.startAt, period, application);
}

async function workspaceEmail(ctx: Parameters<typeof accountForUser>[0], user: Doc<"users">) {
	return (await accountForUser(ctx, user._id, user.email))?.workspaceEmail ?? user.email;
}
