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
import { organizerRoleOf, organizerRolesOf } from "../events/helper";
import { companyLoader, companyWithLogo, eventSemesterValidator } from "../events/queries";
import {
	REMINDER_KINDS,
	REMINDER_LEAD_TIMES,
	type ReminderKind,
} from "../events/reminders/schedule";
import { audienceOf, withStudyYear } from "./audience";
import { baselineCutoffs, baselineRowsAt, baselineStatsAt, semesterEventDocs } from "./checkpoints";
import { byCompany, type EventCounts, metricsOf } from "./companyMetrics";
import { UNREGISTRATION_HISTORY_START } from "./curves";
import { type AnalyticsRegistration, registrationHistory } from "./history";
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
	liveStateOf,
	MAX_REGISTRATIONS_PER_EVENT,
	MIN_FORECAST_EVENTS,
	pastCurvesBefore,
	snapshotOf,
	upcomingEvents,
} from "./snapshot";
import { countsOf, eventStatsAt, statsRowsBetween } from "./stats";

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
		const companyOf = companyLoader(ctx);
		const events = await Promise.all(
			(await upcomingEvents(ctx, now, UPCOMING_EVENTS)).map(async (event) => {
				const live = await liveStateOf(ctx, event, now);
				const company = await companyOf(event.hostingCompany);
				return {
					_id: event._id,
					title: event.title,
					companyName: company.name,
					companyLogoUrl: company.logoUrl,
					myRole: await organizerRoleOf(ctx, event._id, user._id),
					eventStart: event.eventStart,
					registrationOpens: event.registrationOpens,
					participationLimit: event.participationLimit,
					registered: live.registered,
					waitlist: live.waitlist,
					delta24h: live.delta24h,
					status: live.status,
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

async function firstSentAt(ctx: QueryCtx, event: Doc<"events">, kind: ReminderKind, now: number) {
	const deliveries = ctx.db
		.query("eventReminderDeliveries")
		.withIndex("by_eventId_and_kind_and_sentAt", (q) =>
			q.eq("eventId", event._id).eq("kind", kind).gte("sentAt", 0).lte("sentAt", now),
		);
	let scanned = 0;
	for await (const delivery of deliveries) {
		if (delivery.sent && delivery.eventStart === event.eventStart) return delivery.sentAt;
		scanned += 1;
		if (scanned === MAX_REGISTRATIONS_PER_EVENT) break;
	}
	return undefined;
}

async function reminderMarkers(ctx: QueryCtx, event: Doc<"events">, now: number) {
	const markers = await Promise.all(
		REMINDER_KINDS.map(async (kind) => {
			const batch = await ctx.db
				.query("eventReminders")
				.withIndex("by_eventId_and_kind", (q) => q.eq("eventId", event._id).eq("kind", kind))
				.unique();
			const sentAt = await firstSentAt(ctx, event, kind, now);
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
	counts: EventCounts;
	registrants: Id<"users">[];
	filledAt: number | null;
	lateUnregistrations: number | null;
};

export type SemesterKey = { semester: EventSemester; year: number };

export async function semesterEvents(
	ctx: QueryCtx,
	key: SemesterKey,
	now: number,
	checkpointCutoff: number | null = null,
	statsCutoff = Number.POSITIVE_INFINITY,
) {
	const events = await semesterEventDocs(ctx, key, now);
	const { start, end } = eventSemesterRange(key.semester, key.year);
	const storedRows = await statsRowsBetween(ctx, start, end);
	const baseline =
		checkpointCutoff === null
			? null
			: { cutoff: checkpointCutoff, rows: await baselineRowsAt(ctx, now, checkpointCutoff) };
	return await Promise.all(
		events.map(async (event): Promise<SemesterEvent> => {
			const stored = storedRows.get(event._id) ?? null;
			const stats = await (baseline === null
				? eventStatsAt(ctx, event, statsCutoff, stored)
				: baselineStatsAt(ctx, event, now, baseline.cutoff, { ...baseline.rows, stored }));
			return {
				event,
				counts: countsOf(stats),
				registrants: stats.registrants,
				filledAt: stats.filledAt,
				lateUnregistrations: stats.lateUnregistrations,
			};
		}),
	);
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

function attendanceOf({ counts }: SemesterEvent) {
	return {
		registered: counts.registered,
		attended: counts.recorded ? counts.showedUp : null,
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
			Math.min(1, semesterEvent.counts.registered / semesterEvent.event.participationLimit),
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

export async function studentDirectory(ctx: QueryCtx, now: number) {
	const all = await ctx.db.query("students").take(MAX_STUDENTS);
	const known = new Map<Id<"users">, Doc<"students">>();
	for (const student of all) if (!known.has(student.userId)) known.set(student.userId, student);
	const lookup = (userId: Id<"users">) =>
		known.get(userId) ??
		ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
	return {
		population: withStudyYear(all, now),
		studentsOf: async (registrations: readonly Pick<AnalyticsRegistration, "userId">[]) => {
			const userIds = [...new Set(registrations.map((registration) => registration.userId))];
			const students = await Promise.all(userIds.map(lookup));
			const byUser = new Map(
				students.filter((student) => student !== null).map((student) => [student.userId, student]),
			);
			return withStudyYear(
				registrations
					.map((registration) => byUser.get(registration.userId))
					.filter((student) => student !== undefined),
				now,
			);
		},
	};
}

function registrantRowsOf(events: readonly Pick<SemesterEvent, "registrants">[]) {
	return events.flatMap(({ registrants }) => registrants.map((userId) => ({ userId })));
}

export async function logStartedAt(ctx: QueryCtx) {
	const first = await ctx.db.query("registrationLog").first();
	return first?._creationTime ?? null;
}

export async function unregistrationsLoggedFrom(ctx: QueryCtx) {
	const historyImport = await ctx.db.query("unregistrationImports").first();
	if (historyImport?.state !== "done") return await logStartedAt(ctx);
	const earlier = await ctx.db
		.query("registrationLog")
		.withIndex("by_creation_time", (q) => q.lt("_creationTime", UNREGISTRATION_HISTORY_START))
		.first();
	return earlier?._creationTime ?? UNREGISTRATION_HISTORY_START;
}

function isLogged(event: Doc<"events">, logStart: number | null) {
	return logStart !== null && event.eventStart - DAY_MS >= logStart;
}

export function lateUnregistrationsOf(
	{ event, lateUnregistrations }: SemesterEvent,
	logStart: number | null,
) {
	return isLogged(event, logStart) ? lateUnregistrations : null;
}

function lateUnregistrations(events: SemesterEvent[], logStart: number | null, cutoff: number) {
	const counts = events
		.filter(({ event }) => event.eventStart <= cutoff)
		.map((semesterEvent) => lateUnregistrationsOf(semesterEvent, logStart));
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
		const {
			previous,
			previousCutoff,
			previousCheckpoint,
			lastYearSemester,
			lastYear,
			lastYearCheckpoint,
		} = baselineCutoffs(now);
		const [events, previousEvents, lastYearEvents, students] = await Promise.all([
			semesterEvents(ctx, current, now),
			semesterEvents(ctx, previous, previousCutoff, previousCheckpoint),
			semesterEvents(ctx, lastYearSemester, lastYear, lastYearCheckpoint),
			studentDirectory(ctx, now),
		]);
		const yearsSincePrevious = current.semester === "høst" ? 1 : 0;

		const audience = audienceOf(
			await students.studentsOf(registrantRowsOf(events)),
			students.population,
			await students.studentsOf(registrantRowsOf(previousEvents)),
			yearsSincePrevious,
		);
		const logStart = await unregistrationsLoggedFrom(ctx);
		const late = lateUnregistrations(events, logStart, now);
		const lateLastYear = lateUnregistrations(lastYearEvents, logStart, lastYear);

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

export async function pastRowLoaders(ctx: QueryCtx, userId: Id<"users">) {
	return { companyOf: companyLoader(ctx), roleOf: await organizerRolesOf(ctx, userId) };
}

export async function pastEventRow(
	{ companyOf, roleOf }: Awaited<ReturnType<typeof pastRowLoaders>>,
	semesterEvent: SemesterEvent,
	logStart: number | null,
) {
	const { event } = semesterEvent;
	const company = await companyOf(event.hostingCompany);
	return {
		_id: event._id,
		title: event.title,
		companyName: company.name,
		companyLogoUrl: company.logoUrl,
		myRole: roleOf(event._id),
		eventStart: event.eventStart,
		participationLimit: event.participationLimit,
		...attendanceOf(semesterEvent),
		lateUnregistrations: lateUnregistrationsOf(semesterEvent, logStart),
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
		const loaders = await pastRowLoaders(ctx, user._id);
		return await Promise.all(
			events.map((semesterEvent) => pastEventRow(loaders, semesterEvent, logStart)),
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
		const students = await studentDirectory(ctx, Date.now());
		return audienceOf(
			await students.studentsOf(
				registrations.filter((registration) => registration.status === "registered"),
			),
			students.population,
		);
	},
});
