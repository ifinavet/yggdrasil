import { MIN_INTERVIEW_NOTICE_MS } from "@workspace/shared/admissions";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../../auth/accessRights";
import { workspaceEmail } from "../../iam/accounts";
import { activePublishInterviewIds } from "../lifecycle";
import {
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
