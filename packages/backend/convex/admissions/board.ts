import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import schema from "../schema";
import { requireMutablePeriod } from "./access";
import { startDelivery } from "./delivery/workflow";
import { validateInterviewers } from "./mutations";
import { scheduledInterviews, submittedApplications } from "./queries";
import { assertNoScheduleConflicts, MAX_APPLICATIONS, MAX_ROUNDS, validateSettings } from "./rules";
import { interviewerSelection } from "./schema";

const settings = schema
	.doc("admissionPeriods")
	.pick("duration", "buffer", "breakEvery", "breakMinutes", "lunch", "room", "dayStart", "dayEnd")
	.partial();

function requireRevision(period: Doc<"admissionPeriods">, revision: number) {
	if (period.revision !== revision)
		throw new ConvexError("Opptaket er endret av noen andre. Oppdater siden og prøv igjen.");
}

export const updateSettings = mutation({
	args: {
		periodId: v.id("admissionPeriods"),
		expectedRevision: v.number(),
		settings,
		interviewers: v.optional(v.array(interviewerSelection)),
	},
	handler: async (ctx, args) => {
		const period = await requireMutablePeriod(ctx, args.periodId);
		requireRevision(period, args.expectedRevision);
		const next = { ...period, ...args.settings };
		validateSettings(next);
		const { interviewers } = args;
		let membershipChanged = false;
		if (interviewers) {
			await validateInterviewers(ctx, interviewers);
			if (
				interviewers.some(
					(person) =>
						person.selectedCalendarIds.length > 30 ||
						person.selectedCalendarIds.some((id) => !id.trim() || id.length > 320),
				)
			)
				throw new ConvexError("Velg gyldige kalendere, maksimalt 30 per intervjuer.");
			const nextInterviewerIds = new Set(interviewers.map((person) => person.userId));
			membershipChanged =
				nextInterviewerIds.size !== period.interviewers.length ||
				period.interviewers.some((person) => !nextInterviewerIds.has(person.userId));
			const removedInterviewerIds = new Set(
				period.interviewers
					.filter((person) => !nextInterviewerIds.has(person.userId))
					.map((person) => person.userId),
			);
			if (removedInterviewerIds.size) {
				const scheduled = await scheduledInterviews(ctx, period._id, MAX_APPLICATIONS + 1);
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
		}
		const changes = {
			...args.settings,
			room: next.room.trim(),
			...(interviewers && { interviewers }),
		};
		if (
			Object.entries(changes).every(
				([key, value]) =>
					JSON.stringify(value) === JSON.stringify(period[key as keyof typeof changes]),
			)
		)
			return;
		const revision = period.revision + 1;
		await ctx.db.patch(period._id, {
			...changes,
			revision,
			status: "open",
		});
		if (membershipChanged)
			await startDelivery(ctx, {
				kind: "sync_channel",
				periodId: period._id,
				revision,
				idempotencyKey: `sync-channel:${period._id}:${revision}`,
				dueAt: Date.now(),
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
		const interviews = await scheduledInterviews(ctx, period._id, MAX_APPLICATIONS + 1);
		if (
			interviews.length > MAX_APPLICATIONS ||
			[...selected].some((id) => !interviews.some((row) => row.applicationId === id))
		)
			throw new ConvexError("Et valgt intervju finnes ikke i dette opptaket.");
		const proposed = interviews.map((row) =>
			selected.has(row.applicationId) ? { ...row, room } : row,
		);
		assertNoScheduleConflicts(proposed, period.buffer, 0, true);
		const changed = interviews.filter(
			(row) => selected.has(row.applicationId) && row.room !== room,
		);
		const republish =
			period.status === "published" || changed.some((row) => row.publishedAt !== undefined);
		await Promise.all(
			changed.map(async (row) => {
				const revision = row.revision + 1;
				await ctx.db.patch(row._id, {
					room,
					revision,
					publishedAt: undefined,
				});
				if (republish)
					await startDelivery(ctx, {
						kind: "publish",
						periodId: period._id,
						applicationId: row.applicationId,
						interviewId: row._id,
						revision,
						idempotencyKey: `publish:${row._id}:${revision}`,
						dueAt: Date.now(),
					});
			}),
		);
		await ctx.db.patch(period._id, {
			revision: period.revision + 1,
			status: republish ? "published" : "open",
		});
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
		const applications = await submittedApplications(ctx, period._id, MAX_APPLICATIONS + 1);
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
	if (app.sent || app.decision === "accepted" || app.offerStatus !== "none") return app.decision;
	if (direction === "previous")
		return (
			previous?.decisions.find((row) => row.applicationId === app._id)?.decision ?? app.decision
		);
	if (app.decision === "shortlist") return "pending";
	return app.decision === "pending" ? "rejected" : app.decision;
}
