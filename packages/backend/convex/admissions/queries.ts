import { v } from "convex/values";
import { pick } from "convex-helpers";
import { getOneFrom } from "convex-helpers/server/relationships";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { getCurrentUserOrThrow } from "../auth/currentUser";
import { isEmailDeliveryFailure } from "../lib/emailDelivery";
import { MAX_INTERNAL_GROUPS } from "../users/organization/groups";
import { listOperations } from "./delivery/workflow";
import { MAX_APPLICATIONS } from "./rules";

export function submittedApplications(
	ctx: QueryCtx,
	periodId: Id<"admissionPeriods">,
	limit = MAX_APPLICATIONS,
) {
	return ctx.db
		.query("admissionApplications")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "submitted"),
		)
		.take(limit);
}

export function scheduledInterviews(
	ctx: QueryCtx,
	periodId: Id<"admissionPeriods">,
	limit = MAX_APPLICATIONS,
) {
	return ctx.db
		.query("admissionInterviews")
		.withIndex("by_periodId_and_status", (q) =>
			q.eq("periodId", periodId).eq("status", "scheduled"),
		)
		.take(limit);
}

export const openPeriods = query({
	args: { now: v.number() },
	handler: async (ctx, { now }) => {
		const periods = await ctx.db
			.query("admissionPeriods")
			.withIndex("by_status", (q) => q.eq("status", "open"))
			.take(10);
		return periods
			.filter((period) => period.applicationStartAt <= now && now <= period.applicationEndAt)
			.map((period) =>
				pick(period, [
					"_id",
					"title",
					"applicationStartAt",
					"applicationEndAt",
					"interviewStartAt",
					"interviewEndAt",
					"retentionAt",
					"dayStart",
					"dayEnd",
					"timezone",
					"revision",
				]),
			);
	},
});

async function applicantView(
	ctx: QueryCtx,
	application: Doc<"admissionApplications">,
	period: Doc<"admissionPeriods">,
) {
	const interview = await getOneFrom(
		ctx.db,
		"admissionInterviews",
		"by_applicationId",
		application._id,
	);
	return {
		...pick(application, [
			"_id",
			"status",
			"revision",
			"about",
			"motivation",
			"group",
			"availability",
		]),
		periodId: period._id,
		decision: application.decisionSentAt ? application.decision : "pending",
		decisionSentAt: application.decisionSentAt,
		offerStatus: application.decisionSentAt ? application.offerStatus : "none",
		offerDeadline: application.decisionSentAt ? application.offerDeadline : undefined,
		interviewStatus: interview?.status ?? null,
		interview:
			interview?.status === "scheduled" && interview.publishedAt
				? { startAt: interview.startAt, endAt: interview.endAt, room: interview.room }
				: null,
		period: pick(period, [
			"title",
			"applicationStartAt",
			"applicationEndAt",
			"interviewStartAt",
			"interviewEndAt",
			"retentionAt",
			"timezone",
			"dayStart",
			"dayEnd",
		]),
	};
}

export const myApplication = query({
	args: { periodId: v.optional(v.id("admissionPeriods")) },
	handler: async (ctx, { periodId }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const period = periodId
			? await ctx.db.get(periodId)
			: await ctx.db.query("admissionPeriods").first();
		if (!period || period.status === "closing") return null;
		const application = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_userId", (q) =>
				q.eq("periodId", period._id).eq("userId", user._id),
			)
			.unique();
		return application ? applicantView(ctx, application, period) : null;
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
		const period = periodId
			? await ctx.db.get(periodId)
			: await ctx.db.query("admissionPeriods").first();
		if (!period) return null;
		const jobs = (await listOperations(ctx, period._id, true)).filter(
			(job) => job.state === "inProgress" || job.state === "failed",
		);
		const deliveryRows = await ctx.db
			.query("admissionDeliveries")
			.withIndex("by_periodId", (q) => q.eq("periodId", period._id))
			.take(200);
		const unresolvedDeliveries = deliveryRows
			.filter((delivery) => isEmailDeliveryFailure(delivery.status))
			.map(({ _id, kind, status, error }) => ({ _id, kind, status, error }));
		if (period.status === "closing")
			return {
				period,
				candidates: [],
				interviews: [],
				interviewers: [],
				jobs,
				deliveryIssues: [],
			};
		const applications = await submittedApplications(ctx, period._id);
		const groups = await ctx.db
			.query("internalGroups")
			.withIndex("by_name")
			.take(MAX_INTERNAL_GROUPS);
		const groupNames = new Map(groups.map((group) => [group._id, group.name]));
		const allInterviews = await scheduledInterviews(ctx, period._id);
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
		};
	},
});
