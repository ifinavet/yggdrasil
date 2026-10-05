import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { isLocalDevelopment } from "../auth/local";
import { accountForUser } from "../iam/accounts";
import { queueOutbox } from "./lifecycle";

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
		localPreview: v.optional(v.object({ to: v.string(), subject: v.string(), html: v.string() })),
		status: v.optional(v.union(v.literal("queued"), v.literal("delivered"))),
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
				status: args.status ?? "queued",
				error: undefined,
				localPreview: isLocalDevelopment() ? args.localPreview : undefined,
			});
			return existing._id;
		}
		return await ctx.db.insert("admissionDeliveries", {
			...args,
			localPreview: isLocalDevelopment() ? args.localPreview : undefined,
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
				if (!user || user.deleted) return null;
				const account = await accountForUser(ctx, userId, user.email);
				return { email: account?.workspaceEmail ?? user.email };
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
		if (error) {
			await queueOutbox(ctx, {
				kind: "delivery_failure",
				periodId: delivery.periodId,
				applicationId: delivery.applicationId,
				deliveryId: delivery._id,
				revision: 1,
				idempotencyKey: `delivery-failure:${delivery._id}:${status}`,
				nextAttemptAt: Date.now(),
			});
		}
		return true;
	},
});
