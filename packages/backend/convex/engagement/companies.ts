import { TREND_METRICS } from "@workspace/shared/engagement";
import { type HighlightTotals, highlightTotals } from "@workspace/shared/feedback/report";
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
	pickMetrics,
	registeredIn,
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
import { MAX_REGISTRATIONS_PER_EVENT } from "./snapshot";

const HISTORY_SEMESTERS = 4;
const MAX_EARLIER_EVENTS = 50;
const MAX_CAMPAIGNS_PER_EVENT = 10;

async function eventFeedback(ctx: QueryCtx, eventId: Id<"events">) {
	const campaigns = await ctx.db
		.query("feedbackCampaigns")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.take(MAX_CAMPAIGNS_PER_EVENT);
	const totals: HighlightTotals[] = [];
	for (const campaign of campaigns) {
		const report = await ctx.db
			.query("feedbackReports")
			.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
			.first();
		if (report && report.status !== "building") totals.push(highlightTotals(report.questions));
	}
	return totals.length === 0
		? null
		: {
				ratingSum: sumOf(totals, ({ ratingSum }) => ratingSum),
				ratings: sumOf(totals, ({ ratings }) => ratings),
				wantToWork: sumOf(totals, ({ wantToWork }) => wantToWork),
				employmentAnswers: sumOf(totals, ({ employmentAnswers }) => employmentAnswers),
			};
}

function semestersUpTo(key: SemesterKey) {
	const keys = [key];
	while (keys.length < HISTORY_SEMESTERS) {
		const last = keys[keys.length - 1] as SemesterKey;
		keys.push(eventSemesterOf(eventSemesterRange(last.semester, last.year).start - DAY_MS));
	}
	return keys.reverse();
}

async function earlierRegistrants(ctx: QueryCtx, companyId: Id<"companies">, key: SemesterKey) {
	const before = eventSemesterRange(key.semester, key.year).start;
	const [first] = semestersUpTo(eventSemesterOf(before - DAY_MS)) as [SemesterKey];
	const since = eventSemesterRange(first.semester, first.year).start;
	const events = await ctx.db
		.query("events")
		.withIndex("by_hostingCompany_and_eventStart", (q) =>
			q.eq("hostingCompany", companyId).gte("eventStart", since).lt("eventStart", before),
		)
		.take(MAX_EARLIER_EVENTS);
	const users = new Set<Id<"users">>();
	for (const event of events.filter(({ published }) => published)) {
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
			.take(MAX_REGISTRATIONS_PER_EVENT);
		for (const { userId } of registeredIn([{ registrations }])) users.add(userId);
	}
	return users;
}

function returningIn(companyEvent: CompanyEvent, earlier: Set<Id<"users">>) {
	return registeredIn([companyEvent]).filter(({ userId }) => earlier.has(userId)).length;
}

async function loggedEvents(ctx: QueryCtx, key: SemesterKey, now: number) {
	const logStart = await logStartedAt(ctx);
	const grouped = byCompany(await semesterEvents(ctx, key, now));
	const events: CompanyEvent[] = [];
	for (const [companyId, companyEvents] of grouped) {
		const earlier = await earlierRegistrants(ctx, companyId, key);
		for (const semesterEvent of companyEvents) {
			events.push({
				...semesterEvent,
				lateUnregistrations:
					semesterEvent.event.eventStart <= now
						? await lateUnregistrationsOf(ctx, semesterEvent.event, logStart)
						: null,
				feedback: await eventFeedback(ctx, semesterEvent.event._id),
				returning: returningIn(semesterEvent, earlier),
			});
		}
	}
	return { logStart, events };
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
		company: companyEvents ? pickMetrics(metricsOf(companyEvents, cutoff), TREND_METRICS) : null,
		average: pickMetrics(
			averageOf([...grouped.values()].map((group) => metricsOf(group, cutoff))),
			TREND_METRICS,
		),
	};
}

export const history = query({
	args: { companyId: v.id("companies"), now: v.number() },
	handler: async (ctx, { companyId, now }) => {
		await requireRole(ctx, internalRoles);
		const semesters = [];
		for (const key of semestersUpTo(eventSemesterOf(now))) {
			semesters.push(await semesterMetrics(ctx, companyId, key, now));
		}
		return semesters;
	},
});
