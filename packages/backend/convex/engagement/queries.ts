import {
	DAY_MS,
	type EventSemester,
	eventSemesterOf,
	eventSemesterRange,
	formatOsloDate,
	MINUTE_MS,
	WORKDAYS,
} from "@workspace/shared/time";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { eventsInSemester, organizerRoleOf } from "../events/helper";
import { companyWithLogo, eventSemesterValidator } from "../events/queries";
import { REMINDER_KINDS, REMINDER_LEAD_TIMES } from "../events/reminders/schedule";
import { audienceOf, withStudyYear } from "./audience";
import { byCompany, metricsOf } from "./companyMetrics";
import {
	type AnalyticsRegistration,
	firstFilledAt,
	registrationHistory,
	registrationsAt,
} from "./history";
import {
	activityBuckets,
	activityWindowMs,
	PACE_GRID,
	projectFill,
	seatDelta,
	valueAt,
	WAVE_RULE,
} from "./metrics";
import { type AlertRule, isActiveRule } from "./schema";
import {
	MAX_REGISTRATIONS_PER_EVENT,
	MIN_FORECAST_EVENTS,
	pastCurvesBefore,
	snapshotOf,
	UNREGISTRATION_HISTORY_START,
	upcomingEvents,
} from "./snapshot";

const UPCOMING_EVENTS = 30;
const ACTIVE_ALERTS = 20;
const LOG_LOOKBACK = 200;
const ACTIVITY_LOG_LIMIT = 2 * MAX_REGISTRATIONS_PER_EVENT;
const FOLLOW_UP_WINDOW_MS = 10 * MINUTE_MS;
const MAX_STUDENTS = 5000;
const TOP_COMPANIES = 8;

export const upcoming = query({
	args: { now: v.number() },
	handler: async (ctx, { now }) => {
		const user = await requireRole(ctx, internalRoles);
		const pastCurves = await pastCurvesBefore(ctx, now);
		const events = await Promise.all(
			(await upcomingEvents(ctx, now, UPCOMING_EVENTS)).map(async (event) => {
				const snapshot = await snapshotOf(ctx, event, now, pastCurves);
				const company = await companyWithLogo(ctx, event.hostingCompany);
				return {
					_id: event._id,
					title: event.title,
					companyName: company.name,
					companyLogoUrl: company.logoUrl,
					myRole: await organizerRoleOf(ctx, event._id, user._id),
					eventStart: event.eventStart,
					registrationOpens: event.registrationOpens,
					participationLimit: event.participationLimit,
					registered: snapshot.registered,
					waitlist: snapshot.waitlist,
					delta24h: snapshot.delta24h,
					status: snapshot.status,
				};
			}),
		);
		return { events, alerts: await activeAlerts(ctx, now) };
	},
});

async function activeAlerts(ctx: QueryCtx, now: number) {
	const alerts = await ctx.db
		.query("engagementAlerts")
		.withIndex("by_dismissedAt_and_triggeredAt", (q) => q.eq("dismissedAt", undefined))
		.order("desc")
		.take(ACTIVE_ALERTS);
	const withEvents = await Promise.all(
		alerts.map(async (alert) => ({ alert, event: await ctx.db.get(alert.eventId) })),
	);
	return Promise.all(
		withEvents.flatMap(({ alert, event }) =>
			event !== null && event.eventStart > now && isActiveRule(alert.rule)
				? [withActivity(ctx, alert, event, now, alert.rule)]
				: [],
		),
	);
}

async function withActivity(
	ctx: QueryCtx,
	alert: Doc<"engagementAlerts">,
	event: Doc<"events">,
	now: number,
	rule: AlertRule,
) {
	const entries = await ctx.db
		.query("registrationLog")
		.withIndex("by_eventId_and_at", (q) =>
			q.eq("eventId", event._id).gt("at", now - activityWindowMs(rule)),
		)
		.take(ACTIVITY_LOG_LIMIT);
	return {
		_id: alert._id,
		eventId: alert.eventId,
		rule,
		summary: alert.summary,
		detail: alert.detail,
		triggeredAt: alert.triggeredAt,
		activity: activityBuckets(entries, rule, event.registrationOpens, now),
	};
}

export const unregisterLog = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const recent = await ctx.db
			.query("registrationLog")
			.withIndex("by_eventId_and_at", (q) => q.eq("eventId", eventId))
			.order("desc")
			.take(LOG_LOOKBACK);
		const unregistrations = recent.filter((entry) => entry.change === "unregistered");
		const latest = unregistrations[0]?.at ?? 0;
		const inWindow = unregistrations.filter((entry) => entry.at > latest - WAVE_RULE.windowMs);

		const entries = await Promise.all(
			inWindow.map(async (entry) => {
				const student = await ctx.db
					.query("students")
					.withIndex("by_userId", (q) => q.eq("userId", entry.userId))
					.first();
				const movedTo = await followUpEvent(ctx, entry);
				return {
					_id: entry._id,
					at: entry.at,
					fromStatus: entry.fromStatus ?? null,
					studyProgram: student?.studyProgram ?? null,
					year: student?.year ?? null,
					movedTo,
				};
			}),
		);
		return {
			entries,
			topDestination: topDestination(entries),
			followUpMinutes: FOLLOW_UP_WINDOW_MS / MINUTE_MS,
		};
	},
});

async function followUpEvent(ctx: QueryCtx, entry: Doc<"registrationLog">) {
	const after = await ctx.db
		.query("registrationLog")
		.withIndex("by_userId_and_at", (q) =>
			q
				.eq("userId", entry.userId)
				.gt("at", entry.at)
				.lte("at", entry.at + FOLLOW_UP_WINDOW_MS),
		)
		.take(10);
	const next = after.find(
		(candidate) =>
			candidate.eventId !== entry.eventId &&
			(candidate.change === "registered" || candidate.change === "waitlisted"),
	);
	if (!next) return null;
	const event = await ctx.db.get(next.eventId);
	return event ? { eventId: event._id, title: event.title } : null;
}

function topDestination(entries: { movedTo: { eventId: Id<"events">; title: string } | null }[]) {
	const counts = new Map<Id<"events">, { title: string; count: number }>();
	for (const { movedTo } of entries) {
		if (!movedTo) continue;
		const current = counts.get(movedTo.eventId) ?? { title: movedTo.title, count: 0 };
		counts.set(movedTo.eventId, { ...current, count: current.count + 1 });
	}
	return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
}

async function reminderMarkers(ctx: QueryCtx, event: Doc<"events">, now: number) {
	const markers = await Promise.all(
		REMINDER_KINDS.map(async (kind) => {
			const batch = await ctx.db
				.query("eventReminders")
				.withIndex("by_eventId_and_kind", (q) => q.eq("eventId", event._id).eq("kind", kind))
				.unique();
			const deliveries = await ctx.db
				.query("eventReminderDeliveries")
				.withIndex("by_eventId_and_kind_and_userId", (q) =>
					q.eq("eventId", event._id).eq("kind", kind),
				)
				.take(MAX_REGISTRATIONS_PER_EVENT);
			const sentTimes = deliveries.flatMap((d) =>
				d.eventStart === event.eventStart && d.sent && d.sentAt !== undefined && d.sentAt <= now
					? [d.sentAt]
					: [],
			);
			const sentAt = sentTimes.length ? Math.min(...sentTimes) : undefined;
			const queuedAt = batch && batch.queuedAt <= now ? batch.queuedAt : undefined;
			const scheduledAt = event.eventStart - REMINDER_LEAD_TIMES[kind];
			if (sentAt === undefined && queuedAt === undefined && !event.remindersEnabled) return null;
			const at = sentAt ?? queuedAt ?? scheduledAt;
			if (at < event.registrationOpens || at >= event.eventStart) return null;
			let status = scheduledAt > now ? "Planlagt" : "Ingen registrert utsending";
			if (queuedAt !== undefined) status = "Satt i kø";
			if (sentAt !== undefined) status = "Utsending startet";
			return {
				kind,
				at,
				progress: (at - event.registrationOpens) / (event.eventStart - event.registrationOpens),
				status,
				planned: sentAt === undefined && queuedAt === undefined,
			};
		}),
	);
	return markers.filter((marker) => marker !== null);
}

export const paceCurve = query({
	args: { eventId: v.id("events"), now: v.number() },
	handler: async (ctx, { eventId, now }) => {
		await requireRole(ctx, internalRoles);
		const event = await ctx.db.get(eventId);
		if (!event) return null;
		const snapshot = await snapshotOf(
			ctx,
			event,
			now,
			await pastCurvesBefore(ctx, Math.min(now, event.eventStart)),
		);
		const limit = event.participationLimit;
		const projecting =
			snapshot.progress > 0 &&
			snapshot.progress < 1 &&
			snapshot.registered > 0 &&
			(snapshot.baseline?.size ?? 0) >= MIN_FORECAST_EVENTS;
		const projected = projecting ? Math.round(snapshot.projectedFill * limit) : null;
		const { entries } = await registrationHistory(ctx, eventId);
		const span = event.eventStart - event.registrationOpens;
		const countAt = (progress: number) =>
			Math.max(
				0,
				seatDelta(entries.filter(({ at }) => at <= event.registrationOpens + span * progress)),
			);
		const expectedAt = (progress: number) =>
			snapshot.baseline ? Math.round(valueAt(snapshot.baseline.curve, progress) * limit) : null;
		const projectedAt = (progress: number) => {
			if (projected === null) return null;
			if (progress === snapshot.progress) return snapshot.registered;
			if (progress < snapshot.progress) return null;
			return Math.round(
				projectFill(
					snapshot.demandFill,
					snapshot.progress,
					snapshot.baseline?.curve ?? null,
					progress,
				) * limit,
			);
		};

		const points = [
			...PACE_GRID.filter((progress) => progress !== snapshot.progress),
			snapshot.progress,
		]
			.sort((a, b) => a - b)
			.map((progress) => ({
				progress,
				at: event.registrationOpens + span * progress,
				expected: expectedAt(progress),
				actual: progress <= snapshot.progress ? countAt(progress) : null,
				projected: projectedAt(progress),
			}));

		const company = await companyWithLogo(ctx, event.hostingCompany);
		return {
			title: event.title,
			companyName: company.name,
			companyLogoUrl: company.logoUrl,
			limit,
			registered: snapshot.registered,
			progress: snapshot.progress,
			projected,
			typical: expectedAt(1),
			baselineSize: snapshot.baseline?.size ?? 0,
			reminders: await reminderMarkers(ctx, event, now),
			points,
		};
	},
});

export type SemesterEvent = {
	event: Doc<"events">;
	registrations: AnalyticsRegistration[];
	filledAt?: number | null;
};

export type SemesterKey = { semester: EventSemester; year: number };

export async function semesterEvents(ctx: QueryCtx, { semester, year }: SemesterKey, now: number) {
	const events = (await eventsInSemester(ctx, semester, year)).filter(
		(event) =>
			event.published &&
			!event.externalEvent &&
			event.participationLimit > 0 &&
			event.registrationOpens <= now,
	);
	return await Promise.all(
		events.map(async (event): Promise<SemesterEvent> => {
			const history = await registrationHistory(ctx, event._id);
			return {
				event,
				registrations: registrationsAt(history, now),
				filledAt: firstFilledAt(
					history.entries.filter(({ at }) => at <= now),
					event.participationLimit,
				),
			};
		}),
	);
}

function registeredOf({ registrations }: SemesterEvent) {
	return registrations.filter((registration) => registration.status === "registered");
}

async function companyDemand(ctx: QueryCtx, events: SemesterEvent[], now: number) {
	const ranked = [...byCompany(events)]
		.map(([companyId, companyEvents]) => ({
			companyId,
			demand: metricsOf(companyEvents, now).demand ?? 0,
		}))
		.sort((a, b) => b.demand - a.demand);
	return await Promise.all(
		ranked.slice(0, TOP_COMPANIES).map(async ({ companyId, demand }) => ({
			companyId,
			...(await companyWithLogo(ctx, companyId)),
			demand,
		})),
	);
}

function attendanceOf(semesterEvent: SemesterEvent) {
	const registered = registeredOf(semesterEvent);
	const recorded = registered.some((registration) => registration.attendanceStatus);
	return {
		registered: registered.length,
		attended: recorded
			? registered.filter(
					(registration) =>
						registration.attendanceStatus === "confirmed" ||
						registration.attendanceStatus === "late",
				).length
			: null,
	};
}

function weeklyAttendance(events: SemesterEvent[], now: number) {
	const byWeek = new Map<number, { attended: number; registered: number }>();
	for (const semesterEvent of events) {
		if (semesterEvent.event.eventStart > now) continue;
		const { registered, attended } = attendanceOf(semesterEvent);
		if (attended === null) continue;
		const week = Number(formatOsloDate(semesterEvent.event.eventStart, "I"));
		const current = byWeek.get(week) ?? { attended: 0, registered: 0 };
		byWeek.set(week, {
			attended: current.attended + attended,
			registered: current.registered + registered,
		});
	}
	return [...byWeek.entries()]
		.sort(([a], [b]) => a - b)
		.map(([week, totals]) => ({ week, rate: totals.attended / totals.registered }));
}

function fillByTimeslot(events: SemesterEvent[]) {
	const cells = new Map<string, { weekday: number; hour: number; fills: number[] }>();
	for (const semesterEvent of events) {
		const weekday = Number(formatOsloDate(semesterEvent.event.eventStart, "i"));
		if (!WORKDAYS.includes(weekday)) continue;
		const hour = Number(formatOsloDate(semesterEvent.event.eventStart, "H"));
		const key = `${weekday}-${hour}`;
		const cell = cells.get(key) ?? { weekday, hour, fills: [] };
		cell.fills.push(
			Math.min(1, registeredOf(semesterEvent).length / semesterEvent.event.participationLimit),
		);
		cells.set(key, cell);
	}
	return [...cells.values()].map(({ weekday, hour, fills }) => ({
		weekday,
		hour,
		fill: fills.reduce((sum, fill) => sum + fill, 0) / fills.length,
		events: fills.length,
	}));
}

export async function studentsOf(
	ctx: QueryCtx,
	registrations: readonly Pick<AnalyticsRegistration, "userId">[],
	now: number,
) {
	const userIds = [...new Set(registrations.map((registration) => registration.userId))];
	const students = await Promise.all(
		userIds.map((userId) =>
			ctx.db
				.query("students")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.first(),
		),
	);
	const byUser = new Map(
		students.filter((student) => student !== null).map((student) => [student.userId, student]),
	);
	return withStudyYear(
		registrations
			.map((registration) => byUser.get(registration.userId))
			.filter((student) => student !== undefined),
		now,
	);
}

function semesterStudents(ctx: QueryCtx, events: SemesterEvent[], now: number) {
	return studentsOf(ctx, events.flatMap(registeredOf), now);
}

async function studentPopulation(ctx: QueryCtx, now: number) {
	return withStudyYear(await ctx.db.query("students").take(MAX_STUDENTS), now);
}

export async function logStartedAt(ctx: QueryCtx) {
	const first = await ctx.db.query("registrationLog").first();
	return first?._creationTime ?? null;
}

export async function unregistrationsLoggedFrom(ctx: QueryCtx) {
	const logStart = await logStartedAt(ctx);
	if (logStart === null) return null;
	const historyImport = await ctx.db.query("unregistrationImports").first();
	return historyImport?.state === "done"
		? Math.min(logStart, UNREGISTRATION_HISTORY_START)
		: logStart;
}

function isLogged(event: Doc<"events">, logStart: number | null) {
	return logStart !== null && event.eventStart - DAY_MS >= logStart;
}

export async function lateUnregistrationsOf(
	ctx: QueryCtx,
	event: Doc<"events">,
	logStart: number | null,
) {
	if (!isLogged(event, logStart)) return null;
	const late = await ctx.db
		.query("registrationLog")
		.withIndex("by_eventId_and_at", (q) =>
			q
				.eq("eventId", event._id)
				.gt("at", event.eventStart - DAY_MS)
				.lte("at", event.eventStart),
		)
		.take(MAX_REGISTRATIONS_PER_EVENT);
	return late.filter(
		(entry) => entry.change === "unregistered" && entry.fromStatus === "registered",
	).length;
}

async function lateUnregistrations(
	ctx: QueryCtx,
	events: SemesterEvent[],
	logStart: number | null,
	cutoff: number,
) {
	const counts = await Promise.all(
		events
			.filter(({ event }) => event.eventStart <= cutoff)
			.map(({ event }) => lateUnregistrationsOf(ctx, event, logStart)),
	);
	return {
		count: counts.reduce<number>((sum, count) => sum + (count ?? 0), 0),
		uncovered: counts.includes(null),
		empty: counts.length === 0,
	};
}

export const semester = query({
	args: { now: v.number() },
	handler: async (ctx, { now }) => {
		await requireRole(ctx, internalRoles);
		const current = eventSemesterOf(now);
		const currentStart = eventSemesterRange(current.semester, current.year).start;
		const previous = eventSemesterOf(currentStart - DAY_MS);
		const previousRange = eventSemesterRange(previous.semester, previous.year);
		const previousCutoff = Math.min(
			previousRange.start + now - currentStart,
			previousRange.end - 1,
		);
		const lastYear = now - 365 * DAY_MS;
		const events = await semesterEvents(ctx, current, now);
		const previousEvents = await semesterEvents(ctx, previous, previousCutoff);
		const lastYearEvents = await semesterEvents(ctx, eventSemesterOf(lastYear), lastYear);
		const yearsSincePrevious = current.semester === "høst" ? 1 : 0;

		const audience = audienceOf(
			await semesterStudents(ctx, events, now),
			await studentPopulation(ctx, now),
			await semesterStudents(ctx, previousEvents, now),
			yearsSincePrevious,
		);
		const logStart = await unregistrationsLoggedFrom(ctx);
		const late = await lateUnregistrations(ctx, events, logStart, now);
		const lateLastYear = await lateUnregistrations(ctx, lastYearEvents, logStart, lastYear);

		return {
			semester: current,
			companies: await companyDemand(ctx, events, now),
			attendance: weeklyAttendance(events, now),
			lateUnregistrations: {
				current: late.count,
				since: late.uncovered ? logStart : null,
				lastYear: lateLastYear.uncovered || lateLastYear.empty ? null : lateLastYear.count,
			},
			timeslots: fillByTimeslot(events),
			audience,
		};
	},
});

export async function pastEventRow(
	ctx: QueryCtx,
	semesterEvent: SemesterEvent,
	logStart: number | null,
	userId: Id<"users">,
) {
	const { event } = semesterEvent;
	const company = await companyWithLogo(ctx, event.hostingCompany);
	return {
		_id: event._id,
		title: event.title,
		companyName: company.name,
		companyLogoUrl: company.logoUrl,
		myRole: await organizerRoleOf(ctx, event._id, userId),
		eventStart: event.eventStart,
		participationLimit: event.participationLimit,
		...attendanceOf(semesterEvent),
		lateUnregistrations: await lateUnregistrationsOf(ctx, event, logStart),
	};
}

export const past = query({
	args: { now: v.number(), semester: eventSemesterValidator, year: v.number() },
	handler: async (ctx, { now, semester, year }) => {
		const user = await requireRole(ctx, internalRoles);
		const logStart = await unregistrationsLoggedFrom(ctx);
		const events = (await semesterEvents(ctx, { semester, year }, now))
			.filter(({ event }) => event.eventStart <= now)
			.reverse();
		return await Promise.all(
			events.map((semesterEvent) => pastEventRow(ctx, semesterEvent, logStart, user._id)),
		);
	},
});

export const eventAudience = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.take(MAX_REGISTRATIONS_PER_EVENT);
		const now = Date.now();
		return audienceOf(
			await studentsOf(
				ctx,
				registrations.filter((registration) => registration.status === "registered"),
				now,
			),
			await studentPopulation(ctx, now),
		);
	},
});
