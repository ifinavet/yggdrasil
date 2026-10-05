import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import {
	canUpdateEmailDeliveryStatus,
	EMAIL_DELIVERY_ERRORS,
	EMAIL_DELIVERY_EVENT_STATUSES,
} from "../../lib/emailDelivery";
import { startDelivery } from "./workflow";

const deliveryKind = v.union(
	v.literal("offer"),
	v.literal("rejection"),
	v.literal("interview_invite"),
	v.literal("cancelled"),
	v.literal("reminder_3d"),
	v.literal("reminder_1d"),
);

export const recordQueued = internalMutation({
	args: {
		periodId: v.id("admissionPeriods"),
		applicationId: v.id("admissionApplications"),
		kind: deliveryKind,
		idempotencyKey: v.string(),
		emailId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("admissionDeliveries")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
			.unique();
		if (existing?.emailId === args.emailId) return existing._id;
		if (existing) {
			await ctx.db.patch(existing._id, {
				emailId: args.emailId,
				status: "queued",
				error: undefined,
			});
			return existing._id;
		}
		return await ctx.db.insert("admissionDeliveries", {
			...args,
			status: "queued",
		});
	},
});

export const recordProviderEvent = internalMutation({
	args: { emailId: v.string(), type: v.string() },
	handler: async (ctx, { emailId, type }) => {
		const status = EMAIL_DELIVERY_EVENT_STATUSES[type];
		if (!status) return false;
		const delivery = await ctx.db
			.query("admissionDeliveries")
			.withIndex("by_emailId", (q) => q.eq("emailId", emailId))
			.unique();
		if (!delivery) return false;
		if (!canUpdateEmailDeliveryStatus(delivery.status, status)) return true;
		const error = EMAIL_DELIVERY_ERRORS[status];
		await ctx.db.patch(delivery._id, { status, error });
		if (error) {
			await startDelivery(ctx, {
				kind: "delivery_failure",
				periodId: delivery.periodId,
				applicationId: delivery.applicationId,
				deliveryId: delivery._id,
				revision: 1,
				idempotencyKey: `delivery-failure:${delivery._id}:${status}`,
				dueAt: Date.now(),
			});
		}
		return true;
	},
});
