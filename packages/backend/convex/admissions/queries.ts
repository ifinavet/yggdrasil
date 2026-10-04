import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { getCurrentUserOrThrow } from "../auth/currentUser";

export const openPeriods = query({
	args: { now: v.number() },
	handler: async (ctx, { now }) => {
		const periods = await ctx.db
			.query("admissionPeriods")
			.withIndex("by_status", (q) => q.eq("status", "open"))
			.take(10);
		return periods
			.filter((period) => period.applicationStartAt <= now && now <= period.applicationEndAt)
			.map(
				({
					_id,
					title,
					applicationStartAt,
					applicationEndAt,
					interviewStartAt,
					interviewEndAt,
					retentionAt,
					timezone,
					revision,
				}) => ({
					_id,
					title,
					applicationStartAt,
					applicationEndAt,
					interviewStartAt,
					interviewEndAt,
					retentionAt,
					timezone,
					revision,
				}),
			);
	},
});

export const myApplication = query({
	args: { periodId: v.id("admissionPeriods") },
	handler: async (ctx, { periodId }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const period = await ctx.db.get(periodId);
		if (!period || period.status === "closing") return null;
		const application = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_userId", (q) => q.eq("periodId", periodId).eq("userId", user._id))
			.unique();
		if (!application) return null;
		const interview = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
			.unique();
		return {
			_id: application._id,
			periodId,
			status: application.status,
			revision: application.revision,
			about: application.about,
			motivation: application.motivation,
			group: application.group,
			availability: application.availability,
			decision: application.decisionSentAt ? application.decision : "pending",
			decisionSentAt: application.decisionSentAt,
			offerStatus: application.decisionSentAt ? application.offerStatus : "none",
			offerDeadline: application.decisionSentAt ? application.offerDeadline : undefined,
			interview:
				interview?.status === "scheduled" && interview.publishedAt
					? {
							startAt: interview.startAt,
							endAt: interview.endAt,
							room: interview.room,
						}
					: null,
			period: { title: period.title, timezone: period.timezone },
		};
	},
});

export const currentApplication = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUserOrThrow(ctx);
		const submitted = await ctx.db
			.query("admissionApplications")
			.withIndex("by_userId_and_status", (q) => q.eq("userId", user._id).eq("status", "submitted"))
			.order("desc")
			.take(1);
		const drafts = submitted.length
			? []
			: await ctx.db
					.query("admissionApplications")
					.withIndex("by_userId_and_status", (q) => q.eq("userId", user._id).eq("status", "draft"))
					.order("desc")
					.take(1);
		const application = submitted[0] ?? drafts[0];
		if (!application) return null;
		const period = await ctx.db.get(application.periodId);
		if (!period || period.status === "closing") return null;
		const interview = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
			.unique();
		return {
			_id: application._id,
			periodId: period._id,
			status: application.status,
			revision: application.revision,
			about: application.about,
			motivation: application.motivation,
			group: application.group,
			availability: application.availability,
			decision: application.decisionSentAt ? application.decision : "pending",
			decisionSentAt: application.decisionSentAt,
			offerStatus: application.decisionSentAt ? application.offerStatus : "none",
			offerDeadline: application.decisionSentAt ? application.offerDeadline : undefined,
			interview:
				interview?.status === "scheduled" && interview.publishedAt
					? { startAt: interview.startAt, endAt: interview.endAt, room: interview.room }
					: null,
			period: {
				title: period.title,
				applicationStartAt: period.applicationStartAt,
				applicationEndAt: period.applicationEndAt,
				interviewStartAt: period.interviewStartAt,
				interviewEndAt: period.interviewEndAt,
				retentionAt: period.retentionAt,
				timezone: period.timezone,
			},
		};
	},
});

export const adminOverview = query({
	args: { periodId: v.optional(v.id("admissionPeriods")) },
	handler: async (ctx, { periodId }) => {
		await requireRole(ctx, adminRoles);
		let period: Doc<"admissionPeriods"> | null = null;
		if (periodId) period = await ctx.db.get(periodId);
		else {
			const periods = await ctx.db
				.query("admissionPeriods")
				.withIndex("by_status", (q) => q.eq("status", "open"))
				.take(1);
			period = periods[0] ?? null;
			if (!period) {
				const published = await ctx.db
					.query("admissionPeriods")
					.withIndex("by_status", (q) => q.eq("status", "published"))
					.take(1);
				period = published[0] ?? null;
			}
			if (!period) {
				const draft = await ctx.db
					.query("admissionPeriods")
					.withIndex("by_status", (q) => q.eq("status", "draft"))
					.take(1);
				period = draft[0] ?? null;
			}
			if (!period) {
				const closing = await ctx.db
					.query("admissionPeriods")
					.withIndex("by_status", (q) => q.eq("status", "closing"))
					.take(1);
				period = closing[0] ?? null;
			}
		}
		if (!period) return null;
		const outbox = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId", (q) => q.eq("periodId", period._id))
			.take(200);
		if (period.status === "closing")
			return {
				period,
				candidates: [],
				interviews: [],
				interviewers: [],
				jobs: outbox.filter((job) => job.state !== "done"),
			};
		const applications = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", period._id).eq("status", "submitted"),
			)
			.take(200);
		const candidates = await Promise.all(
			applications.map(async (application) => {
				const user = await ctx.db.get(application.userId);
				const interview = await ctx.db
					.query("admissionInterviews")
					.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
					.unique();
				return {
					...application,
					name:
						application.studentProfile?.name ??
						[user?.firstName, user?.lastName].filter(Boolean).join(" "),
					program: application.studentProfile?.studyProgram ?? "",
					year: application.studentProfile?.year ?? 0,
					image: user?.image ?? "",
					interview: interview?.status === "scheduled" ? interview : null,
				};
			}),
		);
		const allInterviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", period._id).eq("status", "scheduled"),
			)
			.take(200);
		const interviewers = await Promise.all(
			period.interviewers.map(async (selection) => {
				const user = await ctx.db.get(selection.userId);
				return {
					id: selection.userId,
					name: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
					email: user?.email ?? "",
					image: user?.image ?? "",
					calendars: selection.selectedCalendarIds,
				};
			}),
		);
		return {
			period,
			candidates,
			interviews: allInterviews,
			interviewers,
			jobs: outbox.filter((job) => job.state !== "done"),
		};
	},
});

export const applicationById = query({
	args: { applicationId: v.id("admissionApplications") },
	handler: async (ctx, { applicationId }) => {
		await requireRole(ctx, adminRoles);
		const application = await ctx.db.get(applicationId);
		if (!application) return null;
		const period = await ctx.db.get(application.periodId);
		if (!period || period.status === "closing") return null;
		const user = await ctx.db.get(application.userId);
		return { ...application, email: user?.email ?? "" };
	},
});
