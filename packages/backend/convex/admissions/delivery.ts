import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

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
		status: v.optional(v.union(v.literal("queued"), v.literal("delivered"))),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("admissionDeliveries")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, {
				emailId: args.emailId,
				status: args.status ?? "queued",
				error: undefined,
			});
			return existing._id;
		}
		return await ctx.db.insert("admissionDeliveries", {
			...args,
			status: args.status ?? "queued",
		});
	},
});

const statuses: Record<string, Doc<"admissionDeliveries">["status"]> = {
	"email.sent": "sent",
	"email.delivered": "delivered",
	"email.delivery_delayed": "delayed",
	"email.bounced": "bounced",
	"email.complained": "complained",
	"email.failed": "failed",
	"email.suppressed": "failed",
};

const errors: Partial<Record<Doc<"admissionDeliveries">["status"], string>> = {
	delayed: "E-posten er forsinket. Kontroller leveringsstatus.",
	bounced: "Mottakerens server avviste e-posten. Kontroller adressen.",
	complained: "E-posten ble markert som søppelpost. Følg opp manuelt.",
	failed: "E-posten kunne ikke leveres. Kontroller Resend-oppsettet.",
};

export const failureContext = internalQuery({
	args: { periodId: v.id("admissionPeriods") },
	handler: async (ctx, { periodId }) => {
		const period = await ctx.db.get(periodId);
		if (!period) return null;
		const interviewers = await Promise.all(
			period.interviewers.map(async ({ userId }) => {
				const user = await ctx.db.get(userId);
				return user && !user.deleted ? { email: user.email } : null;
			}),
		);
		return {
			period,
			interviewers: interviewers.filter(
				(entry): entry is NonNullable<typeof entry> => entry !== null,
			),
		};
	},
});

export const recordProviderEvent = internalMutation({
	args: { emailId: v.string(), type: v.string() },
	handler: async (ctx, { emailId, type }) => {
		const status = statuses[type];
		if (!status) return false;
		const delivery = await ctx.db
			.query("admissionDeliveries")
			.withIndex("by_emailId", (q) => q.eq("emailId", emailId))
			.unique();
		if (!delivery) return false;
		if (["bounced", "complained", "failed"].includes(delivery.status)) return true;
		if (delivery.status === "delivered" && ["queued", "sent", "delayed"].includes(status))
			return true;
		const error = errors[status];
		await ctx.db.patch(delivery._id, { status, error });
		if (error)
			await ctx.scheduler.runAfter(0, internal.admissions.actions.notifyDeliveryFailure, {
				periodId: delivery.periodId,
				key: `delivery-failure:${delivery.idempotencyKey}:${status}`,
				kind: delivery.kind,
				status,
			});
		return true;
	},
});
