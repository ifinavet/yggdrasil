import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { getCurrentUserOrThrow } from "../auth/currentUser";
import { isLocalDevelopment } from "../auth/local";
import { MAX_INTERNAL_GROUPS } from "../users/organization/groups";
import { listOperations } from "./workflow";

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
					dayStart,
					dayEnd,
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
					dayStart,
					dayEnd,
					timezone,
					revision,
				}),
			);
	},
});

async function applicantView(
	ctx: QueryCtx,
	application: Doc<"admissionApplications">,
	period: Doc<"admissionPeriods">,
) {
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
		interviewStatus: interview?.status ?? null,
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
			dayStart: period.dayStart,
			dayEnd: period.dayEnd,
		},
	};
}

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
		return applicantView(ctx, application, period);
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
		return applicantView(ctx, application, period);
	},
});

export const availableGroups = query({
	args: {},
	handler: async (ctx) => {
		await getCurrentUserOrThrow(ctx);
		return await ctx.db
			.query("internalGroups")
			.withIndex("by_name")
			.take(MAX_INTERNAL_GROUPS)
			.then((groups) => groups.map(({ _id, name }) => ({ _id, name })));
	},
});

export const adminOverview = query({
	args: { periodId: v.optional(v.id("admissionPeriods")) },
	handler: async (ctx, { periodId }) => {
		await requireRole(ctx, adminRoles);
		let period: Doc<"admissionPeriods"> | null = null;
		if (periodId) period = await ctx.db.get(periodId);
		else {
			for (const status of ["open", "published", "draft", "closing"] as const) {
				period = await ctx.db
					.query("admissionPeriods")
					.withIndex("by_status", (q) => q.eq("status", status))
					.first();
				if (period) break;
			}
		}
		if (!period) return null;
		const jobs = (await listOperations(ctx, period._id, true)).filter(
			(job) => job.state === "inProgress" || job.state === "failed",
		);
		const deliveryRows = await ctx.db
			.query("admissionDeliveries")
			.withIndex("by_periodId", (q) => q.eq("periodId", period._id))
			.take(200);
		const unresolvedDeliveries = deliveryRows
			.filter((delivery) =>
				["delayed", "failed", "bounced", "complained"].includes(delivery.status),
			)
			.map(({ _id, kind, status, error }) => ({ _id, kind, status, error }));
		const localEmails = isLocalDevelopment()
			? deliveryRows.flatMap(({ localPreview }) => (localPreview ? [localPreview] : []))
			: [];
		if (period.status === "closing")
			return {
				period,
				candidates: [],
				interviews: [],
				interviewers: [],
				jobs,
				deliveryIssues: [],
				localEmails: [],
			};
		const applications = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", period._id).eq("status", "submitted"),
			)
			.take(200);
		const groups = await ctx.db
			.query("internalGroups")
			.withIndex("by_name")
			.take(MAX_INTERNAL_GROUPS);
		const groupNames = new Map(groups.map((group) => [group._id, group.name]));
		const allInterviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", period._id).eq("status", "scheduled"),
			)
			.take(200);
		const candidates = await Promise.all(
			applications.map(async (application) => {
				const user = await ctx.db.get(application.userId);
				const interview = allInterviews.find((row) => row.applicationId === application._id);
				let groupName = "";
				if (application.group === "unsure") groupName = "Usikker ennå";
				else if (application.group)
					groupName = groupNames.get(application.group) ?? "Arbeidsgruppen finnes ikke lenger";
				return {
					...application,
					groupId: application.group === "unsure" ? undefined : application.group,
					group: groupName,
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
			jobs,
			deliveryIssues: unresolvedDeliveries,
			localEmails,
		};
	},
});
