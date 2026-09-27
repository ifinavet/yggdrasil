import { DAY_MS, eventSemesterOf, eventSemesterRange } from "@workspace/shared/time";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { companyWithLogo, eventSemesterValidator } from "../events/queries";
import { audienceOf, uniqueStudents } from "./audience";
import {
	averageOf,
	byCompany,
	type CompanyEvent,
	comparisonOf,
	metricsOf,
	sumOf,
} from "./companyMetrics";
import {
	lateUnregistrationsOf,
	logStartedAt,
	pastEventRow,
	type SemesterKey,
	semesterEvents,
	studentsOf,
} from "./queries";

const HISTORY_SEMESTERS = 4;

async function loggedEvents(ctx: QueryCtx, key: SemesterKey, now: number) {
	const logStart = await logStartedAt(ctx);
	const events = await semesterEvents(ctx, key, now);
	return {
		logStart,
		events: await Promise.all(
			events.map(
				async (semesterEvent): Promise<CompanyEvent> => ({
					...semesterEvent,
					lateUnregistrations:
						semesterEvent.event.eventStart <= now
							? await lateUnregistrationsOf(ctx, semesterEvent.event, logStart)
							: null,
				}),
			),
		),
	};
}

function registeredIn(events: readonly CompanyEvent[]) {
	return events.flatMap(({ registrations }) =>
		registrations.filter((registration) => registration.status === "registered"),
	);
}

const semesterArgs = { now: v.number(), semester: eventSemesterValidator, year: v.number() };

export const list = query({
	args: semesterArgs,
	handler: async (ctx, { now, semester, year }) => {
		await requireRole(ctx, internalRoles);
		const { events } = await loggedEvents(ctx, { semester, year }, now);
		const rows = await Promise.all(
			[...byCompany(events)].map(async ([companyId, companyEvents]) => ({
				companyId,
				...(await companyWithLogo(ctx, companyId)),
				events: companyEvents.length,
				registered: registeredIn(companyEvents).length,
				seats: sumOf(companyEvents, ({ event }) => event.participationLimit),
				...metricsOf(companyEvents, now),
			})),
		);
		return rows.sort((a, b) => (b.demand ?? 0) - (a.demand ?? 0));
	},
});

export const detail = query({
	args: { companyId: v.id("companies"), ...semesterArgs },
	handler: async (ctx, { companyId, now, semester, year }) => {
		await requireRole(ctx, internalRoles);
		const { events, logStart } = await loggedEvents(ctx, { semester, year }, now);
		const grouped = byCompany(events);
		const companyEvents = grouped.get(companyId) ?? [];
		const bedpresStudents = uniqueStudents(await studentsOf(ctx, registeredIn(events), now));
		return {
			...(await companyWithLogo(ctx, companyId)),
			comparison: comparisonOf(
				metricsOf(companyEvents, now),
				[...grouped.values()].map((group) => metricsOf(group, now)),
			),
			audience: audienceOf(
				await studentsOf(ctx, registeredIn(companyEvents), now),
				bedpresStudents,
			),
			events: await Promise.all(
				companyEvents
					.filter(({ event }) => event.eventStart <= now)
					.reverse()
					.map((companyEvent) => pastEventRow(ctx, companyEvent, logStart)),
			),
		};
	},
});

async function semesterMetrics(
	ctx: QueryCtx,
	companyId: Id<"companies">,
	key: SemesterKey,
	now: number,
) {
	const cutoff = Math.min(now, eventSemesterRange(key.semester, key.year).end - 1);
	const grouped = byCompany(await semesterEvents(ctx, key, cutoff));
	const companyEvents = grouped.get(companyId);
	return {
		...key,
		company: companyEvents ? metricsOf(companyEvents, cutoff) : null,
		average: averageOf([...grouped.values()].map((group) => metricsOf(group, cutoff))),
	};
}

export const history = query({
	args: { companyId: v.id("companies"), now: v.number() },
	handler: async (ctx, { companyId, now }) => {
		await requireRole(ctx, internalRoles);
		const keys: SemesterKey[] = [eventSemesterOf(now)];
		while (keys.length < HISTORY_SEMESTERS) {
			const last = keys[keys.length - 1] as SemesterKey;
			keys.push(eventSemesterOf(eventSemesterRange(last.semester, last.year).start - DAY_MS));
		}
		const semesters = [];
		for (const key of keys.reverse()) {
			semesters.push(await semesterMetrics(ctx, companyId, key, now));
		}
		return semesters;
	},
});
