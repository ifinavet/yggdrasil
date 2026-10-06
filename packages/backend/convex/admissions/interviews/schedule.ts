import { MIN_INTERVIEW_NOTICE_MS } from "@workspace/shared/admissions";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../../auth/accessRights";
import { workspaceEmail } from "../../iam/accounts";
import { startDelivery } from "../delivery/workflow";
import { activePublishInterviewIds } from "../lifecycle";
import { submittedApplications } from "../queries";
import {
	assertNoScheduleConflicts,
	interviewCalendarIds,
	MAX_APPLICATIONS,
	sameInterviewSchedule,
	validateInterviewWindow,
} from "../rules";

export const scheduleContext = internalQuery({
	args: { periodId: v.id("admissionPeriods") },
	handler: async (ctx, { periodId }) => {
		await requireRole(ctx, adminRoles);
		const period = await ctx.db.get(periodId);
		if (!period || period.status === "closing")
			throw new ConvexError("Fant ikke en aktiv opptaksperiode.");
		const applications = await submittedApplications(ctx, periodId, MAX_APPLICATIONS + 1);
		if (applications.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange søknader til å lage en plan.");
		const allInterviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) => q.eq("periodId", periodId))
			.take(MAX_APPLICATIONS + 1);
		if (allInterviews.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange intervjuer i opptaket.");
		const candidates = applications.map((application) => ({
			applicationId: application._id,
			availability: application.availability,
			existingInterview: allInterviews.find((row) => row.applicationId === application._id) ?? null,
		}));
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
		const existingInterviews = allInterviews.filter((row) => row.status === "scheduled");
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
				interviewerIds: v.array(v.id("users")),
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
		const applications = await submittedApplications(ctx, periodId, MAX_APPLICATIONS + 1);
		if (applications.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange søknader til å lagre en plan.");

		const result = await commitSchedule(ctx, period, applications, assignments);
		return { count: result.count };
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

		const calendarOwnerId = before?.calendarEventId
			? (before.calendarOwnerId ?? before.interviewerIds[0])
			: undefined;
		const interviewerIds =
			calendarOwnerId && assignment.interviewerIds.includes(calendarOwnerId)
				? [calendarOwnerId, ...assignment.interviewerIds.filter((id) => id !== calendarOwnerId)]
				: assignment.interviewerIds;
		const desired = {
			...assignment,
			interviewerIds,
			selectedCalendarIds: interviewCalendarIds(period, interviewerIds),
			endAt: assignment.startAt + period.duration * 60_000,
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
				calendarOwnerId,
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
	const republished = new Set<Id<"admissionApplications">>();
	await Promise.all(
		changes.map(async (fields) => {
			const before = previous.find((interview) => interview.applicationId === fields.applicationId);
			if (before) await ctx.db.replace(before._id, fields);
			else await ctx.db.insert("admissionInterviews", fields);
			const application = applications.find((item) => item._id === fields.applicationId);
			if (application) await ctx.db.patch(application._id, { revision: application.revision + 1 });
			if (before?.status !== "scheduled" || before.publishedAt === undefined) return;
			republished.add(fields.applicationId);
			await startDelivery(ctx, {
				kind: "publish",
				periodId: period._id,
				applicationId: fields.applicationId,
				interviewId: before._id,
				revision: fields.revision,
				idempotencyKey: `publish:${before._id}:${fields.revision}`,
				dueAt: Date.now(),
				rescheduled: true,
			});
		}),
	);
	await ctx.db.patch(period._id, {
		status: changes.some((item) => !republished.has(item.applicationId)) ? "open" : period.status,
		revision: period.revision + 1,
		...(updatedBy && { updatedBy }),
	});
	return {
		count: fixed.length + changes.length,
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

type ScheduleAssignment = Pick<
	Doc<"admissionInterviews">,
	"applicationId" | "startAt" | "interviewerIds" | "room"
> & { candidateConfirmedOutsideForm?: boolean; confirmPublishedReschedule?: boolean };
function validateAssignment(
	assignment: ScheduleAssignment &
		Pick<Doc<"admissionInterviews">, "endAt" | "selectedCalendarIds">,
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
