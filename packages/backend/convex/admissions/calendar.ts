"use node";

import {
	interviewerAvailable,
	MIN_INTERVIEW_NOTICE_MS,
	makeSchedulingDays,
	makeSchedulingSlots,
	matchInterviews,
	type SchedulingCandidate,
	type SchedulingInterviewer,
	type SchedulingSlot,
} from "@workspace/shared/admissions";
import { osloDateTimeToEpoch } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import { isLocalDevelopment } from "../auth/local";
import { googleConfig, isWorkspaceEmail } from "../iam/config";
import { externalBusyIntervals, googleCalendarClient } from "../iam/googleCalendar";

const localCalendars = [
	{ id: "navet", name: "Navet" },
	{ id: "timetable", name: "Timeplan" },
	{ id: "personal", name: "Privat" },
];

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
		if (!access) throw new Error("Fant ikke valgt intervjuer.");
		const selectedIds: string[] = access.interviewer.selectedCalendarIds;
		if (isLocalDevelopment())
			return localCalendars.map((calendar) => ({
				...calendar,
				selected: selectedIds.length
					? selectedIds.includes(calendar.id)
					: calendar.id !== "personal",
				readable: true,
			}));
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

type ScheduleContext = {
	period: {
		_id: Id<"admissionPeriods">;
		revision: number;
		interviewStartAt: number;
		interviewEndAt: number;
		duration: number;
		buffer: number;
		breakEvery: number;
		breakMinutes: number;
		lunch: boolean;
		room: string;
		dayStart: number;
		dayEnd: number;
		breaks: Array<{ day: string; start: number; end: number }>;
		timezone: string;
		interviewers: Array<{ userId: Id<"users">; selectedCalendarIds: string[] }>;
	};
	candidates: Array<{
		applicationId: Id<"admissionApplications">;
		availability: Array<{ day: string; start: number; end: number }>;
		existingInterview?: { status: string; publishedAt?: number } | null;
	}>;
	interviewers: Array<{
		userId: Id<"users">;
		email: string;
		selectedCalendarIds: string[];
	}>;
	existingInterviews: Array<{
		_id: Id<"admissionInterviews">;
		interviewerIds: Id<"users">[];
		selectedCalendarIds: string[];
		startAt: number;
		endAt: number;
		publishedAt?: number;
	}>;
};

function busyWindows(intervals: ReadonlyArray<{ start: number; end: number }>, timeZone: string) {
	return intervals.flatMap((interval) => {
		const first = localDateAndMinute(interval.start, timeZone);
		const last = localDateAndMinute(interval.end - 1, timeZone);
		const windows: Array<{ day: string; start: number; end: number }> = [];
		const day = new Date(`${first.day}T00:00:00Z`);
		const lastDay = Date.parse(`${last.day}T00:00:00Z`);
		while (day.getTime() <= lastDay) {
			const currentDay = day.toISOString().slice(0, 10);
			windows.push({
				day: currentDay,
				start: currentDay === first.day ? first.minute : 0,
				end: currentDay === last.day ? last.minute + 1 : 1440,
			});
			day.setUTCDate(day.getUTCDate() + 1);
		}
		return windows;
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

function localDateAndMinute(at: number, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(at);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return {
		day: `${value("year")}-${value("month")}-${value("day")}`,
		minute: Number(value("hour")) * 60 + Number(value("minute")),
	};
}

function reasonForUnmatched(
	candidate: SchedulingCandidate,
	slots: readonly SchedulingSlot[],
	team: readonly SchedulingInterviewer[],
) {
	const available = slots.filter((slot) =>
		candidate.availability.some(
			(window) =>
				window.day === slot.day &&
				window.start <= slot.start &&
				window.end >= slot.start + (slot.end - slot.start),
		),
	);
	if (!available.length) return "no_applicant_availability";
	return available.some(
		(slot) => team.filter((person) => interviewerAvailable(person, slot)).length >= 2,
	)
		? "schedule_capacity_reached"
		: "no_interviewer_availability";
}

function coversBusyInterval(
	target: { start: number; end: number },
	intervals: ReadonlyArray<{ start: number; end: number }>,
) {
	let coveredUntil = target.start;
	for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
		if (interval.start > coveredUntil) return false;
		coveredUntil = Math.max(coveredUntil, interval.end);
		if (coveredUntil >= target.end) return true;
	}
	return false;
}

export const generateSchedule = action({
	args: { periodId: v.id("admissionPeriods"), expectedRevision: v.number() },
	handler: async (
		ctx: ActionCtx,
		{ periodId, expectedRevision },
	): Promise<{
		count: number;
		unmatched: Array<{ applicationId: Id<"admissionApplications">; reason: string }>;
	}> => {
		const context = (await ctx.runQuery(internal.admissions.internal.scheduleContext, {
			periodId,
		})) as ScheduleContext;
		if (context.period.revision !== expectedRevision)
			throw new Error("Opptaket er endret. Last inn på nytt før du lager planen.");
		const { period } = context;
		const local = isLocalDevelopment();
		const config = local ? null : googleConfig();
		if (!local && !config)
			throw new Error("Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.");
		if (
			!local &&
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
				if (local)
					return {
						id: person.userId,
						calendars: calendarIds.map((calendarId) => ({
							selected: true,
							readable: true,
							busy: publishedCalendarBusy(context, person.userId, calendarId),
						})),
					};
				if (!config) throw new Error("Google Calendar mangler konfigurasjon.");
				const client = googleCalendarClient(config, person.email);
				const calendars = await client.freeBusy(
					calendarIds,
					new Date(period.interviewStartAt).toISOString(),
					new Date(period.interviewEndAt).toISOString(),
				);
				const ownIds = new Set<string>(
					context.existingInterviews
						.filter((interview) => interview.interviewerIds.includes(person.userId))
						.map((interview) => interview._id),
				);
				return {
					id: person.userId,
					calendars: await Promise.all(
						calendarIds.map(async (calendarId) => {
							const pinned = publishedCalendarBusy(context, person.userId, calendarId);
							const freeBusy = calendars?.[calendarId]?.busy ?? [];
							if (!freeBusy.length) return { selected: true, readable: true, busy: pinned };
							const events = await client.listEvents(
								calendarId,
								new Date(period.interviewStartAt).toISOString(),
								new Date(period.interviewEndAt).toISOString(),
							);
							const external = externalBusyIntervals(events, ownIds, period._id);
							const known = [
								...external,
								...events.flatMap((event) => {
									const id = event.extendedProperties?.shared?.navetAdmissionsInterviewId;
									if (
										!id ||
										!ownIds.has(id) ||
										event.extendedProperties?.shared?.navetAdmissionsPeriodId !== period._id
									)
										return [];
									return externalBusyIntervals([event]);
								}),
							];
							const parsed = freeBusy.map((entry) => ({
								start: Date.parse(entry.start),
								end: Date.parse(entry.end),
							}));
							if (
								parsed.some(
									(interval) =>
										!Number.isFinite(interval.start) ||
										!Number.isFinite(interval.end) ||
										interval.end <= interval.start ||
										!coversBusyInterval(interval, known),
								)
							)
								throw new Error(
									"En valgt Google-kalender har opptattstatus som ikke kan kontrolleres.",
								);
							return {
								selected: true,
								readable: true,
								busy: [...busyWindows(external, period.timezone), ...pinned],
							};
						}),
					),
				};
			}),
		);
		const days = makeSchedulingDays(
			period.interviewStartAt,
			period.interviewEndAt,
			period.timezone,
		);
		const allSlots = makeSchedulingSlots(
			{
				duration: period.duration,
				buffer: period.buffer,
				breakEvery: period.breakEvery,
				breakMinutes: period.breakMinutes,
				lunch: period.lunch,
				room: period.room,
				dayStart: period.dayStart,
				dayEnd: period.dayEnd,
				breaks: period.breaks,
			},
			days,
		);
		const slots = allSlots.filter((slot) => {
			const startAt = osloDateTimeToEpoch(
				slot.day,
				`${String(Math.floor(slot.start / 60)).padStart(2, "0")}:${String(slot.start % 60).padStart(2, "0")}`,
			);
			return startAt >= Date.now() + MIN_INTERVIEW_NOTICE_MS;
		});
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
			const startAt = osloDateTimeToEpoch(
				slot.day,
				`${String(Math.floor(slot.start / 60)).padStart(2, "0")}:${String(slot.start % 60).padStart(2, "0")}`,
			);
			return {
				applicationId: assignment.candidateId as Id<"admissionApplications">,
				startAt,
				endAt: startAt + period.duration * 60_000,
				interviewerIds: assignment.interviewers as Id<"users">[],
				selectedCalendarIds: [
					...new Set(
						context.interviewers
							.filter((person) => assignment.interviewers.includes(person.userId))
							.flatMap((person) => person.selectedCalendarIds),
					),
				].sort((a, b) => a.localeCompare(b)),
				room: period.room,
			};
		});
		const result = await ctx.runMutation(internal.admissions.internal.saveSchedule, {
			periodId,
			expectedRevision,
			assignments: savedAssignments,
		});
		const assignedIds = new Set(assignments.map((assignment) => assignment.candidateId));
		const unmatched = eligibleCandidates
			.filter((candidate) => !assignedIds.has(candidate.applicationId))
			.map((candidate) => ({
				applicationId: candidate.applicationId,
				reason: reasonForUnmatched(
					{ id: candidate.applicationId, availability: candidate.availability },
					slots,
					team,
				),
			}));
		return { count: result.count, unmatched };
	},
});
