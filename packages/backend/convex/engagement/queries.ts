import {
	DAY_MS,
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
import { eventsInSemester } from "../events/helper";
import { companyWithLogo } from "../events/queries";
import { audienceOf } from "./audience";
import { activityBuckets, activityWindowMs, PACE_STEPS, valueAt, WAVE_RULE } from "./metrics";
import {
	MAX_REGISTRATIONS_PER_EVENT,
	pastCurvesBefore,
	registrationTimesOf,
	snapshotOf,
	upcomingEvents,
	waitlistCountOf,
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
		await requireRole(ctx, internalRoles);
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
					eventStart: event.eventStart,
					registrationOpens: event.registrationOpens,
					participationLimit: event.participationLimit,
					registered: snapshot.registered,
					waitlist: await waitlistCountOf(ctx, event._id),
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
			event !== null && event.eventStart > now ? [withActivity(ctx, alert, event, now)] : [],
		),
	);
}

async function withActivity(
	ctx: QueryCtx,
	alert: Doc<"engagementAlerts">,
	event: Doc<"events">,
	now: number,
) {
	const entries = await ctx.db
		.query("registrationLog")
		.withIndex("by_eventId_and_at", (q) =>
			q.eq("eventId", event._id).gt("at", now - activityWindowMs(alert.rule)),
		)
		.take(ACTIVITY_LOG_LIMIT);
	return {
		_id: alert._id,
		eventId: alert.eventId,
		rule: alert.rule,
		summary: alert.summary,
		detail: alert.detail,
		triggeredAt: alert.triggeredAt,
		activity: activityBuckets(entries, alert.rule, event.registrationOpens, now),
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

export const paceCurve = query({
	args: { eventId: v.id("events"), now: v.number() },
	handler: async (ctx, { eventId, now }) => {
		await requireRole(ctx, internalRoles);
		const event = await ctx.db.get(eventId);
		if (!event) return null;
		const snapshot = await snapshotOf(ctx, event, now, await pastCurvesBefore(ctx, now));
		const limit = event.participationLimit;
		const times = [...(await registrationTimesOf(ctx, eventId))].sort((a, b) => a - b);
		const span = event.eventStart - event.registrationOpens;
		const countAt = (progress: number) =>
			times.filter((time) => time <= event.registrationOpens + span * progress).length;
		const expectedAt = (progress: number) =>
			snapshot.baseline ? Math.round(valueAt(snapshot.baseline.curve, progress) * limit) : null;
		const projectedAt = (progress: number) => {
			if (progress === snapshot.progress) return snapshot.registered;
			if (progress === 1) return Math.round(snapshot.projectedFill * limit);
			return null;
		};

		const steps = Array.from({ length: PACE_STEPS + 1 }, (_, step) => step / PACE_STEPS);
		const points = [
			...steps.filter((progress) => progress !== snapshot.progress),
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
			projected: Math.round(snapshot.projectedFill * limit),
			typical: expectedAt(1),
			baselineSize: snapshot.baseline?.size ?? 0,
			points,
		};
	},
});

type SemesterEvent = {
	event: Doc<"events">;
	registrations: Doc<"registrations">[];
};

async function semesterEvents(ctx: QueryCtx, timestamp: number, now: number) {
	const { semester, year } = eventSemesterOf(timestamp);
	const events = (await eventsInSemester(ctx, semester, year)).filter(
		(event) =>
			event.published &&
			!event.externalEvent &&
			event.participationLimit > 0 &&
			event.registrationOpens <= now,
	);
	return await Promise.all(
		events.map(
			async (event): Promise<SemesterEvent> => ({
				event,
				registrations: await ctx.db
					.query("registrations")
					.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
					.take(MAX_REGISTRATIONS_PER_EVENT),
			}),
		),
	);
}

function registeredOf({ registrations }: SemesterEvent) {
	return registrations.filter((registration) => registration.status === "registered");
}

async function companyDemand(ctx: QueryCtx, events: SemesterEvent[]) {
	const byCompany = new Map<Id<"companies">, { interested: number; seats: number }>();
	for (const semesterEvent of events) {
		const current = byCompany.get(semesterEvent.event.hostingCompany) ?? {
			interested: 0,
			seats: 0,
		};
		byCompany.set(semesterEvent.event.hostingCompany, {
			interested: current.interested + semesterEvent.registrations.length,
			seats: current.seats + semesterEvent.event.participationLimit,
		});
	}
	const ranked = [...byCompany.entries()]
		.map(([companyId, totals]) => ({ companyId, demand: totals.interested / totals.seats }))
		.sort((a, b) => b.demand - a.demand)
		.slice(0, TOP_COMPANIES);
	return await Promise.all(
		ranked.map(async ({ companyId, demand }) => ({
			companyId,
			...(await companyWithLogo(ctx, companyId)),
			demand,
		})),
	);
}

function weeklyAttendance(events: SemesterEvent[], now: number) {
	const byWeek = new Map<number, { attended: number; registered: number }>();
	for (const semesterEvent of events) {
		if (semesterEvent.event.eventStart > now) continue;
		const registered = registeredOf(semesterEvent);
		if (!registered.some((registration) => registration.attendanceStatus)) continue;
		const week = Number(formatOsloDate(semesterEvent.event.eventStart, "I"));
		const current = byWeek.get(week) ?? { attended: 0, registered: 0 };
		byWeek.set(week, {
			attended:
				current.attended +
				registered.filter(
					(registration) =>
						registration.attendanceStatus === "confirmed" ||
						registration.attendanceStatus === "late",
				).length,
			registered: current.registered + registered.length,
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

async function studentsOf(ctx: QueryCtx, registrations: readonly Doc<"registrations">[]) {
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
	return registrations
		.map((registration) => byUser.get(registration.userId))
		.filter((student) => student !== undefined);
}

function semesterStudents(ctx: QueryCtx, events: SemesterEvent[]) {
	return studentsOf(ctx, events.flatMap(registeredOf));
}

async function studentPopulation(ctx: QueryCtx) {
	return await ctx.db.query("students").take(MAX_STUDENTS);
}

async function lateUnregistrations(ctx: QueryCtx, events: SemesterEvent[]) {
	const counts = await Promise.all(
		events.map(async ({ event }) => {
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
		}),
	);
	return counts.reduce((sum, count) => sum + count, 0);
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
		const events = await semesterEvents(ctx, now, now);
		const previousEvents = await semesterEvents(ctx, previousCutoff, previousCutoff);
		const lastYearEvents = await semesterEvents(ctx, lastYear, lastYear);

		const audience = audienceOf(
			await semesterStudents(ctx, events),
			await studentPopulation(ctx),
			await semesterStudents(ctx, previousEvents),
		);

		return {
			semester: current,
			companies: await companyDemand(ctx, events),
			attendance: weeklyAttendance(events, now),
			lateUnregistrations: {
				current: await lateUnregistrations(ctx, events),
				lastYear: await lateUnregistrations(ctx, lastYearEvents),
			},
			timeslots: fillByTimeslot(events),
			audience,
		};
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
		return audienceOf(
			await studentsOf(
				ctx,
				registrations.filter((registration) => registration.status === "registered"),
			),
			await studentPopulation(ctx),
		);
	},
});
