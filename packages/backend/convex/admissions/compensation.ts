import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { startDelivery } from "./workflow";

export const queueStalePublishCleanup = internalMutation({
	args: {
		periodId: v.id("admissionPeriods"),
		interviewId: v.id("admissionInterviews"),
		publishedRevision: v.number(),
	},
	handler: async (ctx, { periodId, interviewId, publishedRevision }) => {
		const [period, interview] = await Promise.all([ctx.db.get(periodId), ctx.db.get(interviewId)]);
		if (!period || interview?.periodId !== periodId || interview.status !== "cancelled")
			return false;
		const invite = await ctx.db
			.query("admissionDeliveries")
			.withIndex("by_idempotencyKey", (q) =>
				q.eq("idempotencyKey", `admission:interview:${interviewId}:${publishedRevision}:invite`),
			)
			.unique();
		const now = Date.now();
		await startDelivery(ctx, {
			kind: "cancel_interview",
			periodId,
			applicationId: interview.applicationId,
			interviewId,
			revision: interview.revision,
			idempotencyKey: `late-publish-cancel:${interviewId}:${interview.revision}`,
			dueAt: now,
			notifyApplicant: invite !== null,
		});
		return true;
	},
});
