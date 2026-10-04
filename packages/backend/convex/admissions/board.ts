import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import schema from "../schema";
import { requireMutablePeriod } from "./access";
import { validateInterviewers } from "./mutations";
import { MAX_APPLICATIONS, MAX_ROUNDS, validateSettings } from "./rules";
import { interviewerSelection } from "./schema";

const settings = schema
	.doc("admissionPeriods")
	.pick("duration", "buffer", "breakEvery", "breakMinutes", "lunch", "room", "dayStart", "dayEnd")
	.partial();

function requireRevision(period: Doc<"admissionPeriods">, revision: number) {
	if (period.revision !== revision)
		throw new ConvexError("Opptaket er endret av noen andre. Oppdater siden og prøv igjen.");
}

export const updateInterviewers = mutation({
	args: {
		periodId: v.id("admissionPeriods"),
		expectedRevision: v.number(),
		interviewers: v.array(interviewerSelection),
	},
	handler: async (ctx, args) => {
		const period = await requireMutablePeriod(ctx, args.periodId);
		requireRevision(period, args.expectedRevision);
		await validateInterviewers(ctx, args.interviewers);
		if (
			args.interviewers.some(
				(person) =>
					person.selectedCalendarIds.length > 30 ||
					person.selectedCalendarIds.some((id) => !id.trim() || id.length > 320),
			)
		)
			throw new ConvexError("Velg gyldige kalendere, maksimalt 30 per intervjuer.");
		const nextInterviewerIds = new Set(args.interviewers.map((person) => person.userId));
		const removedInterviewerIds = new Set(
			period.interviewers
				.filter((person) => !nextInterviewerIds.has(person.userId))
				.map((person) => person.userId),
		);
		if (removedInterviewerIds.size) {
			const scheduled = await ctx.db
				.query("admissionInterviews")
				.withIndex("by_periodId_and_status", (q) =>
					q.eq("periodId", period._id).eq("status", "scheduled"),
				)
				.take(MAX_APPLICATIONS + 1);
			if (
				scheduled.some(
					(interview) =>
						interview.publishedAt &&
						interview.startAt > Date.now() &&
						interview.interviewerIds.some((id) => removedInterviewerIds.has(id)),
				)
			)
				throw new ConvexError(
					"Intervjuere kan ikke fjernes når de er tildelt publiserte intervjuer.",
				);
		}
		await ctx.db.patch(period._id, {
			interviewers: args.interviewers,
			revision: period.revision + 1,
			status: "open",
		});
	},
});

export const updateSettings = mutation({
	args: { periodId: v.id("admissionPeriods"), expectedRevision: v.number(), settings },
	handler: async (ctx, args) => {
		const period = await requireMutablePeriod(ctx, args.periodId);
		requireRevision(period, args.expectedRevision);
		const next = { ...period, ...args.settings };
		validateSettings(next);
		await ctx.db.patch(period._id, {
			...args.settings,
			room: next.room.trim(),
			status: "open",
			revision: period.revision + 1,
		});
	},
});

export const assignRooms = mutation({
	args: {
		periodId: v.id("admissionPeriods"),
		expectedRevision: v.number(),
		applicationIds: v.array(v.id("admissionApplications")),
		room: v.string(),
	},
	handler: async (ctx, args) => {
		const period = await requireMutablePeriod(ctx, args.periodId);
		requireRevision(period, args.expectedRevision);
		const room = args.room.trim();
		validateSettings({ ...period, room });
		const selected = new Set(args.applicationIds);
		if (!selected.size || selected.size > MAX_APPLICATIONS)
			throw new ConvexError("Velg intervjuer først.");
		const interviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", period._id).eq("status", "scheduled"),
			)
			.take(MAX_APPLICATIONS + 1);
		if (
			interviews.length > MAX_APPLICATIONS ||
			[...selected].some((id) => !interviews.some((row) => row.applicationId === id))
		)
			throw new ConvexError("Et valgt intervju finnes ikke i dette opptaket.");
		const proposed = interviews.map((row) =>
			selected.has(row.applicationId) ? { ...row, room } : row,
		);
		for (let index = 0; index < proposed.length; index++) {
			const interview = proposed[index];
			if (!interview) continue;
			if (
				proposed
					.slice(index + 1)
					.some(
						(other) =>
							other.room === interview.room &&
							other.startAt < interview.endAt + period.buffer * 60_000 &&
							other.endAt + period.buffer * 60_000 > interview.startAt,
					)
			)
				throw new ConvexError("Rommet er allerede i bruk av et annet intervju på samme tid.");
		}
		await Promise.all(
			interviews
				.filter((row) => selected.has(row.applicationId))
				.map((row) => ctx.db.patch(row._id, { room, revision: row.revision + 1 })),
		);
		await ctx.db.patch(period._id, { revision: period.revision + 1, status: "open" });
	},
});

export const changeRound = mutation({
	args: {
		periodId: v.id("admissionPeriods"),
		expectedRevision: v.number(),
		direction: v.union(v.literal("next"), v.literal("previous")),
	},
	handler: async (ctx, args) => {
		const period = await requireMutablePeriod(ctx, args.periodId);
		requireRevision(period, args.expectedRevision);
		const applications = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", period._id).eq("status", "submitted"),
			)
			.take(MAX_APPLICATIONS + 1);
		if (applications.length > MAX_APPLICATIONS)
			throw new ConvexError("For mange kandidater i opptaket.");
		const previous = period.roundHistory.at(-1);
		if (args.direction === "previous" && !previous)
			throw new ConvexError("Du er allerede i første runde.");
		if (args.direction === "next") {
			if (period.roundHistory.length >= MAX_ROUNDS)
				throw new ConvexError("Maksimalt antall runder er nådd.");
			if (!applications.some((app) => app.decision === "shortlist"))
				throw new ConvexError("Flytt kandidater til Videre først.");
		}
		await Promise.all(
			applications.map(async (app) => {
				const decision = roundDecision(app, args.direction, previous);
				if (decision !== app.decision)
					await ctx.db.patch(app._id, {
						decision,
						revision: app.revision + 1,
						decisionRevision: app.decisionRevision + 1,
					});
			}),
		);
		await ctx.db.patch(period._id, {
			revision: period.revision + 1,
			round: period.round + (args.direction === "next" ? 1 : -1),
			roundHistory:
				args.direction === "previous"
					? period.roundHistory.slice(0, -1)
					: [
							...period.roundHistory,
							{
								decisions: applications.map((app) => ({
									applicationId: app._id,
									decision: app.decision,
								})),
							},
						],
		});
	},
});

function roundDecision(
	app: Doc<"admissionApplications">,
	direction: "next" | "previous",
	previous: Doc<"admissionPeriods">["roundHistory"][number] | undefined,
): Doc<"admissionApplications">["decision"] {
	// Communicated offers and accepted candidates survive round changes.
	if (app.sent || app.decision === "accepted" || app.offerStatus !== "none") return app.decision;
	if (direction === "previous")
		return (
			previous?.decisions.find((row) => row.applicationId === app._id)?.decision ?? app.decision
		);
	if (app.decision === "shortlist") return "pending";
	return app.decision === "pending" ? "rejected" : app.decision;
}
