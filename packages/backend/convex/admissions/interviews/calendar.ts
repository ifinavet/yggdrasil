"use node";

import {
	MIN_INTERVIEW_NOTICE_MS,
	makeSchedulingDays,
	makeSchedulingSlots,
	matchInterviews,
	type SchedulingCandidate,
	type SchedulingInterviewer,
} from "@workspace/shared/admissions";
import {
	calendarDaysBetween,
	localDateAndMinute,
	osloDateTimeToEpoch,
} from "@workspace/shared/time";
import type { FunctionReturnType } from "convex/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { type ActionCtx, action } from "../../_generated/server";
import { googleConfig, isWorkspaceEmail } from "../../iam/config";
import {
	calendarEventId,
	googleCalendarClient,
	type OwnedAdmissionEvent,
	readExternalBusy,
} from "../../iam/googleCalendar";
import { interviewCalendarIds } from "../rules";

export const sources = action({
	args: { periodId: v.id("admissionPeriods"), interviewerId: v.id("users") },
	handler: async (
		ctx,
		{ periodId, interviewerId },
	): Promise<Array<{ id: string; name: string; selected: boolean; readable: boolean }>> => {
		const access = await ctx.runQuery(internal.admissions.internal.calendarAccess, {
			periodId,
			interviewerId,
		});
		const selectedIds: string[] = access.interviewer.selectedCalendarIds;
		const config = googleConfig();
		if (!config)
			throw new Error("Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.");
		if (!isWorkspaceEmail(access.email, config.domain))
			throw new Error("Intervjueren mangler en Navet Workspace-konto for kalenderdelegering.");
		const calendarClient = googleCalendarClient(config, access.email);
		const calendars = await calendarClient.listCalendars();
		const defaults = calendars.filter((calendar) =>
			/navet|timeplan|timetable/i.test(calendar.summary ?? ""),
		);
		const defaultsSelected = new Set(defaults.map((calendar) => calendar.id));
		return await Promise.all(
			calendars.map(async (calendar) => {
				let readable = true;
				try {
					await calendarClient.freeBusy(
						[calendar.id],
						new Date(access.period.interviewStartAt).toISOString(),
						new Date(access.period.interviewEndAt).toISOString(),
					);
					await calendarClient.listEvents(
						calendar.id,
						new Date(access.period.interviewStartAt).toISOString(),
						new Date(access.period.interviewEndAt).toISOString(),
					);
				} catch {
					readable = false;
				}
				return {
					id: calendar.id,
					name: calendar.summary ?? "Google Calendar",
					selected: selectedIds.length
						? selectedIds.includes(calendar.id)
						: defaultsSelected.has(calendar.id),
					readable,
				};
			}),
		);
	},
});

type ScheduleContext = NonNullable<
	FunctionReturnType<typeof internal.admissions.interviews.schedule.scheduleContext>
>;

function busyWindows(intervals: ReadonlyArray<{ start: number; end: number }>, timeZone: string) {
	return intervals.flatMap((interval) => {
		const first = localDateAndMinute(interval.start, timeZone);
		const last = localDateAndMinute(interval.end - 1, timeZone);
		return calendarDaysBetween(first.day, last.day, timeZone).map((day) => ({
			day,
			start: day === first.day ? first.minute : 0,
			end: day === last.day ? last.minute + 1 : 1440,
		}));
	});
}

function publishedCalendarBusy(
	context: ScheduleContext,
	interviewerId: Id<"users">,
	calendarId: string,
) {
	return busyWindows(
		context.existingInterviews
			.filter(
				(interview) =>
					interview.publishedAt !== undefined &&
					interview.interviewerIds.includes(interviewerId) &&
					interview.selectedCalendarIds.includes(calendarId),
			)
			.map(({ startAt, endAt }) => ({
				start: startAt,
				end: endAt + context.period.buffer * 60_000,
			})),
		context.period.timezone,
	);
}

export const generateSchedule = action({
	args: { periodId: v.id("admissionPeriods"), expectedRevision: v.number() },
	handler: async (ctx: ActionCtx, { periodId, expectedRevision }): Promise<{ count: number }> => {
		const context = await ctx.runQuery(internal.admissions.interviews.schedule.scheduleContext, {
			periodId,
		});
		if (context.period.revision !== expectedRevision)
			throw new Error("Opptaket er endret. Last inn på nytt før du lager planen.");
		const { period } = context;
		const config = googleConfig();
		if (!config)
			throw new Error("Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.");
		if (
			context.interviewers.some(
				(person) =>
					person.selectedCalendarIds.length > 0 &&
					!isWorkspaceEmail(person.email, config?.domain ?? null),
			)
		)
			throw new Error("En intervjuer mangler en Navet Workspace-konto for kalenderdelegering.");
		const team: SchedulingInterviewer[] = await Promise.all(
			context.interviewers.map(async (person) => {
				const calendarIds = person.selectedCalendarIds;
				if (!calendarIds.length) return { id: person.userId, calendars: [] };
				const client = googleCalendarClient(config, person.email);
				const ownedEvents = new Map<string, OwnedAdmissionEvent>(
					await Promise.all(
						context.existingInterviews
							.filter((interview) => interview.interviewerIds.includes(person.userId))
							.map(
								async (interview) =>
									[
										interview._id,
										{
											eventId: await calendarEventId(`navet-admissions:${interview._id}`),
											interviewId: interview._id,
											periodId: period._id,
										},
									] as const,
							),
					),
				);
				const external = await readExternalBusy(
					client,
					calendarIds,
					new Date(period.interviewStartAt).toISOString(),
					new Date(period.interviewEndAt).toISOString(),
					ownedEvents,
				);
				return {
					id: person.userId,
					calendars: calendarIds.map((calendarId, index) => ({
						selected: true,
						readable: true,
						busy: [
							...busyWindows(external[index] ?? [], period.timezone),
							...publishedCalendarBusy(context, person.userId, calendarId),
						],
					})),
				};
			}),
		);
		const days = makeSchedulingDays(
			period.interviewStartAt,
			period.interviewEndAt,
			period.timezone,
		);
		const slots = makeSchedulingSlots(period, days)
			.map((slot) => ({
				...slot,
				startAt: osloDateTimeToEpoch(
					slot.day,
					`${String(Math.floor(slot.start / 60)).padStart(2, "0")}:${String(slot.start % 60).padStart(2, "0")}`,
				),
			}))
			.filter((slot) => slot.startAt >= Date.now() + MIN_INTERVIEW_NOTICE_MS);
		const eligibleCandidates = context.candidates.filter(
			(candidate) =>
				candidate.existingInterview?.publishedAt === undefined &&
				candidate.existingInterview?.status !== "cancelled",
		);
		const candidates: SchedulingCandidate[] = eligibleCandidates.map((candidate) => ({
			id: candidate.applicationId,
			availability: candidate.availability,
		}));
		const assignments = matchInterviews(candidates, slots, team);
		const bySlot = new Map(slots.map((slot) => [slot.id, slot]));
		const savedAssignments = assignments.map((assignment) => {
			const slot = bySlot.get(assignment.slotId);
			if (!slot) throw new Error("Kunne ikke bygge en gyldig intervjutid.");

			return {
				applicationId: assignment.candidateId as Id<"admissionApplications">,
				startAt: slot.startAt,
				endAt: slot.startAt + period.duration * 60_000,
				interviewerIds: assignment.interviewers as Id<"users">[],
				selectedCalendarIds: interviewCalendarIds(period, assignment.interviewers as Id<"users">[]),
				room: period.room,
			};
		});
		const result = await ctx.runMutation(internal.admissions.interviews.schedule.saveSchedule, {
			periodId,
			expectedRevision,
			assignments: savedAssignments,
		});
		return { count: result.count };
	},
});
