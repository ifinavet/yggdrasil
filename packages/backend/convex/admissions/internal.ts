import { localWindow } from "@workspace/shared/admissions";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../auth/accessRights";
import { accountForUser } from "../iam/accounts";
import { finishClose, purgeBatch as purgeRecordsBatch, queueOutbox } from "./lifecycle";
import { MAX_APPLICATIONS } from "./rules";

async function isCurrent(ctx: Parameters<typeof requireRole>[0], job: Doc<"admissionOutbox">) {
	const period = await ctx.db.get(job.periodId);
	if (job.kind === "archive_channel") return period?.status === "closing";
	if (!period) return false;
	if (job.kind === "cancel_interview") {
		const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
		return interview?.status === "cancelled" && interview.revision === job.revision;
	}
	if (period.status === "closing") return false;
	if (job.kind === "publish" || job.kind === "remind_3d" || job.kind === "remind_1d") {
		const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
		if (interview?.status !== "scheduled" || interview.revision !== job.revision) return false;
		return job.kind === "publish"
			? period.status === "published"
			: interview.publishedAt !== undefined;
	}
	if (job.kind === "delivery_failure") {
		const delivery = job.deliveryId ? await ctx.db.get(job.deliveryId) : null;
		return (
			delivery?.periodId === job.periodId &&
			["delayed", "failed", "bounced", "complained"].includes(delivery.status)
		);
	}
	return isApplicationJobCurrent(ctx, job);
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
			return null;
		}
		await ctx.db.patch(job._id, {
			state: "running",
			attempts: job.attempts + 1,
			lastError: undefined,
		});
		const period = await ctx.db.get(job.periodId);
		const application = job.applicationId ? await ctx.db.get(job.applicationId) : null;
		const interview = job.interviewId ? await ctx.db.get(job.interviewId) : null;
		const delivery = job.deliveryId ? await ctx.db.get(job.deliveryId) : null;
		const applicantUser = application ? await ctx.db.get(application.userId) : null;
		const interviewerIds = interview?.interviewerIds ?? [];
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
		await ctx.db.patch(job._id, { state: "failed", lastError: error.slice(0, 500), nextAttemptAt });
		await ctx.scheduler.runAfter(
			Math.max(0, nextAttemptAt - Date.now()),
			internal.admissions.actions.processOutbox,
			{ idempotencyKey },
		);
		return { stale: false };
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
		const eligibility = await Promise.all(
			period.interviewers.map(async ({ userId }) => ({
				userId,
				active: await userHasRole(ctx, userId, internalRoles),
			})),
		);
		const active = new Set(
			eligibility.filter((entry) => entry.active).map((entry) => entry.userId),
		);
		const scheduled = assignments.map((assignment) =>
			validateAssignment(assignment, period, applications, selectionByUser, active),
		);
		assertNoScheduleConflicts(scheduled, period.buffer);
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
		await ctx.db.patch(periodId, { status: "open", revision: period.revision + 1 });
		return { count: saved.length, unmatched: applicationsNotScheduled(applications, saved) };
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
		await Promise.all(
			applications
				.filter((app) => app.offerStatus === "pending")
				.map((app) =>
					ctx.db.patch(app._id, { offerStatus: "expired", revision: app.revision + 1 }),
				),
		);
		const interviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "scheduled"),
			)
			.take(MAX_APPLICATIONS);
		await Promise.all(
			interviews.map(async (interview) => {
				if (interview.calendarEventId || interview.publishedAt) {
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
		await ctx.db.patch(application._id, {
			decisionQueuedAt: undefined,
			decisionSentAt,
			sent: true,
			offerStatus: application.decision === "accepted" ? "pending" : "none",
			offerDeadline:
				application.decision === "accepted"
					? Math.min(currentPeriod.retentionAt, decisionSentAt + 7 * 86400000)
					: undefined,
			revision: application.revision + 1,
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
	if (interviewerIds.length < 2 || interviewerIds.length !== assignment.interviewerIds.length)
		throw new ConvexError("Hvert intervju må ha to ulike intervjuere.");
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
) {
	const conflict = scheduled.some((assignment, index) =>
		scheduled
			.slice(index + 1)
			.some(
				(other) =>
					other.startAt < assignment.endAt + buffer * 60_000 &&
					assignment.startAt < other.endAt + buffer * 60_000 &&
					(other.room === assignment.room ||
						other.interviewerIds.some((id) => assignment.interviewerIds.includes(id))),
			),
	);
	if (conflict) throw new ConvexError("Intervjuer eller rom er allerede opptatt i denne tiden.");
}

function validateAssignmentTime(
	assignment: ScheduleAssignment,
	period: Doc<"admissionPeriods">,
	application: Doc<"admissionApplications">,
) {
	const duration = (assignment.endAt - assignment.startAt) / 60_000;
	if (
		!Number.isInteger(duration) ||
		duration !== period.duration ||
		assignment.startAt < period.interviewStartAt ||
		assignment.endAt > period.interviewEndAt
	)
		throw new ConvexError("Et intervju ligger utenfor perioden eller har feil varighet.");
	const window = localWindow(assignment.startAt, duration, period.timezone);
	const meeting = { ...window, end: window.start + duration };
	if (
		meeting.start < period.dayStart ||
		meeting.end + period.buffer > period.dayEnd ||
		(period.lunch && meeting.start < 13 * 60 && meeting.end + period.buffer > 12 * 60) ||
		period.breaks.some(
			(pause) =>
				pause.day === meeting.day &&
				pause.start < meeting.end + period.buffer &&
				meeting.start < pause.end,
		)
	)
		throw new ConvexError("Et intervju kolliderer med arbeidstid eller pause.");
	if (
		!application.availability.some(
			(available) =>
				available.day === meeting.day &&
				available.start <= meeting.start &&
				available.end >= meeting.end,
		)
	)
		throw new ConvexError("En søker er ikke tilgjengelig på tildelt tidspunkt.");
}

async function workspaceEmail(ctx: Parameters<typeof accountForUser>[0], user: Doc<"users">) {
	return (await accountForUser(ctx, user._id, user.email))?.workspaceEmail ?? user.email;
}
